import path from "node:path";
import { USORA_TOOL_NAMES } from "../tool-catalog.ts";
import type { Dependency } from "./types.ts";

export const CONTENT_ANALYSIS_LIMIT = 100;
export type ContentAnalysis = { hasSecrets: boolean; dependencies: Dependency[]; limited: boolean };

const usoraToolNames = new Set<string>(USORA_TOOL_NAMES);
const expressionLanguages = new Set([".py", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".rb", ".pl", ".ps1"]);
const secretPatterns = [
  /-----BEGIN (?:[A-Z0-9 ]*PRIVATE KEY|OPENSSH PRIVATE KEY)-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bnpm_[A-Za-z0-9]{20,}\b/,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{16,}\b/,
  /\bBearer\s+(?!TOKEN\b|YOUR_|<|\$)[A-Za-z0-9._~-]{16,}/i,
  /https?:\/\/[^\s/:]+:[^\s/@]+@/i,
];
const runtimePatterns: [string, RegExp][] = [
  ["Python", /(?:\bpython[23]?\s|^#![^\n]*\bpython[23]?\b|\bpip[3]?\s+(?:install|run)\b)/im],
  ["Node.js", /(?:\bnode\s+(?:scripts\/|[^\n ]+\.[mc]?js)|\b(?:npm|npx|pnpm|yarn)\s+|^#![^\n]*\bnode\b)/im],
  ["Bun", /\bbun\s+(?:run|x|install|scripts\/)/i],
  ["shell", /(?:^#![^\n]*\b(?:ba|z|da|k)?sh\b|\b(?:bash|sh|zsh)\s+scripts\/)/im],
  ["PowerShell", /\b(?:powershell|pwsh)(?:\.exe)?\s+/i],
  ["Windows command processor", /\bcmd(?:\.exe)?\s+\/[ck]\b/i],
  ["TypeScript runtime or compiler", /\b(?:tsx|ts-node|tsc|deno)\s+/i],
];
const extensionRuntimes: Record<string, string> = {
  ".py": "Python",
  ".js": "Node.js",
  ".mjs": "Node.js",
  ".cjs": "Node.js",
  ".ts": "TypeScript runtime or compiler",
  ".tsx": "TypeScript runtime or compiler",
  ".sh": "shell",
  ".bash": "shell",
  ".rb": "Ruby",
  ".pl": "Perl",
  ".ps1": "PowerShell",
  ".cmd": "Windows command processor",
  ".bat": "Windows command processor",
};

function expressionContext(file: string, content: string): (offset: number) => boolean {
  if (expressionLanguages.has(path.posix.extname(file).toLowerCase())) return () => true;
  if (!/\.mdx?$/i.test(file)) return () => false;
  const ranges: { start: number; end: number }[] = [];
  let open: { marker: string; width: number; language: string; start: number } | null = null;
  for (const fence of content.matchAll(/^ {0,3}(`{3,}|~{3,})([^\n]*)$/gm)) {
    const marker = fence[1]![0]!;
    const info = fence[2]!.trim();
    if (!open)
      open = {
        marker,
        width: fence[1]!.length,
        language: info.split(/[ \t]/, 1)[0]!,
        start: fence.index + fence[0].length,
      };
    else if (marker === open.marker && fence[1]!.length >= open.width && !info) {
      if (/^(?:python|py|javascript|js|typescript|ts|ruby|perl|powershell|ps1)$/i.test(open.language))
        ranges.push({ start: open.start, end: fence.index });
      open = null;
    }
  }
  if (open && /^(?:python|py|javascript|js|typescript|ts|ruby|perl|powershell|ps1)$/i.test(open.language))
    ranges.push({ start: open.start, end: content.length });
  // Assignment matches arrive in source order; each range is visited once.
  let current = 0;
  return (offset) => {
    while (current < ranges.length && ranges[current]!.end <= offset) current++;
    return current < ranges.length && ranges[current]!.start <= offset;
  };
}

function hasLiteralSecret(content: string, file: string): boolean {
  const inExpression = expressionContext(file, content);
  const assignments = content.matchAll(
    /\b(?:api[_-]?key|(?:access[_-]?|auth[_-]?)?token|client[_-]?secret|password|passwd|secret(?:[_-]?key)?)\b["']?[ \t]*([=:])[ \t]*/gi,
  );
  for (const assignment of assignments) {
    const code = inExpression(assignment.index);
    let start = assignment.index + assignment[0].length;
    if (code && assignment[1] === ":") {
      const type = /^[^\n=;'"{}]+=[ \t]*/.exec(content.slice(start));
      if (type) start += type[0].length;
    }
    const match = /^(?:"([^"\n]*)"|'([^'\n]*)'|([^\s,}\]]+))/.exec(content.slice(start));
    if (!match) continue;
    const quoted = match[1] !== undefined || match[2] !== undefined;
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (
      !value ||
      /^(?:\$|%|<|\{|YOUR_|example\b|placeholder\b|changeme\b|REDACTED\b|REPLACE_ME\b|process\.env\b|os\.environ\b|(?:os\.)?getenv\(|(?:config|args|options)\.|null$|undefined$|true$|false$)/i.test(
        value,
      )
    )
      continue;
    // Config scalars remain literal values. In expression languages an unquoted
    // variable/member/call is computed data, rather than a credential literal.
    if (!quoted && code && /^(?:[A-Za-z_$][A-Za-z0-9_$]*(?:[.([?+*/%&|^<>=!-]|$)|[([{])/.test(value)) continue;
    return true;
  }
  return false;
}

/** Pure static analysis; no filesystem access, adapter registration or report mutation. */
export function analyzeSkillContent(content: string, file: string): ContentAnalysis {
  const result: ContentAnalysis = {
    hasSecrets: secretPatterns.some((pattern) => pattern.test(content)) || hasLiteralSecret(content, file),
    dependencies: [],
    limited: false,
  };
  const seen = new Set<string>();
  function add(dependency: Dependency): void {
    const key = `${dependency.kind}\0${dependency.name}`;
    if (seen.has(key)) return;
    if (result.dependencies.length >= CONTENT_ANALYSIS_LIMIT) {
      result.limited = true;
      return;
    }
    seen.add(key);
    result.dependencies.push(dependency);
  }
  let usoraMentioned = /\busora\b[\s\S]{0,40}\bmcp\b|\bmcp\b[\s\S]{0,40}\b(?:usora|foundry)\b/i.test(content);
  if (!usoraMentioned) {
    for (const match of content.matchAll(/\b[a-z]+(?:_[a-z0-9]+)+\b/g)) {
      if (usoraToolNames.has(match[0])) {
        usoraMentioned = true;
        break;
      }
    }
  }
  if (usoraMentioned)
    add({
      kind: "usora_mcp",
      name: "Usora MCP",
      required: true,
      reason: `Usora tool or MCP reference in ${file}; provision Usora or replace the workflow before independent use.`,
    });
  else if (/\bmcp(?:__|[ .:/_-]|\b)/i.test(content))
    add({
      kind: "mcp",
      name: "MCP server",
      required: true,
      reason: `MCP reference in ${file}; configure the required server in the target host.`,
    });
  for (const [name, pattern] of runtimePatterns) {
    if (pattern.test(content))
      add({
        kind: "runtime",
        name,
        required: true,
        reason: `${name} command or interpreter in ${file}; availability is not verified by static validation.`,
      });
  }
  const extension = path.posix.extname(file).toLowerCase();
  const runtime = extensionRuntimes[extension];
  if (file.startsWith("scripts/") && runtime)
    add({
      kind: "runtime",
      name: runtime,
      required: true,
      reason: `Bundled script ${file} needs its interpreter or compiler; availability is not verified.`,
    });
  if (
    (file.startsWith("scripts/") && [".ps1", ".cmd", ".bat"].includes(extension)) ||
    /\b(?:powershell|pwsh|cmd\.exe|winget|choco|apt-get|apt install|brew install|systemctl|launchctl)\b|\b[A-Za-z]:\\/i.test(
      content,
    )
  )
    add({
      kind: "platform",
      name: "platform-specific command",
      required: true,
      reason: `Platform-specific script, command or path in ${file}; review target OS support.`,
    });
  for (const match of content.matchAll(
    /\$\{?([A-Z][A-Z0-9_]*)\}?|(?:getenv|environ\.get)\(["']([A-Z][A-Z0-9_]*)["']\)/g,
  )) {
    const name = match[1] || match[2]!;
    if (/TOKEN|KEY|SECRET|PASSWORD/.test(name))
      add({
        kind: "credential",
        name,
        required: true,
        reason: `Environment credential reference in ${file}; values must be supplied separately.`,
      });
    if (result.limited) break;
  }
  if (!result.limited && /\benvironment\b|\bcredential|\bprovide\b|\brequires?\b/i.test(content)) {
    for (const match of content.matchAll(/\b[A-Z][A-Z0-9_]*\b/g)) {
      if (/TOKEN|KEY|SECRET|PASSWORD/.test(match[0]))
        add({
          kind: "credential",
          name: match[0],
          required: true,
          reason: `Environment credential reference in ${file}; values must be supplied separately.`,
        });
      if (result.limited) break;
    }
  }
  if (!result.limited) {
    for (const match of content.matchAll(/https?:\/\/([^\s/<>"')]+)/g)) {
      const host = match[1]!.split("@").at(-1)!;
      add({
        kind: "external_service",
        name: host,
        required: true,
        reason: `External URL in ${file}; resource is not bundled and offline operation is not verified.`,
      });
      if (result.limited) break;
    }
  }
  if (/\b(?:scripts|references|assets)\/(?:[^\s`]*\$|[^\s`]*\{|\*)/.test(content))
    add({
      kind: "dynamic_resource",
      name: "dynamic resource path",
      required: true,
      reason: `Dynamic path in ${file} cannot be resolved statically; replace it with explicit resource references.`,
    });
  return result;
}
