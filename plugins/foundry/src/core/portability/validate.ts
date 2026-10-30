import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { parseDocument, visit, isAlias, isPair, isScalar } from "yaml";
import { validateArchivePaths } from "../../../../../packages/shared/src/zip.ts";
import { anchorHome, HUB_SCHEMA_VERSION, knowledgeDirPath } from "../storage.ts";
import { analyzeSkillContent, CONTENT_ANALYSIS_LIMIT } from "./content-analysis.ts";
import type { BufferedSkillFile, Diagnostic, SkillSnapshot, ValidationResult } from "./types.ts";

export const PORTABILITY_LIMITS = {
  files: 100,
  file_bytes: 1024 * 1024,
  total_bytes: 16 * 1024 * 1024,
  analysis_entries: CONTENT_ANALYSIS_LIMIT,
};
const portableName = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const resourceRoots = new Set(["scripts", "references", "assets"]);
const textExtensions = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".svg",
  ".csv",
  ".tsv",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".py",
  ".sh",
  ".bash",
  ".ps1",
  ".cmd",
  ".bat",
  ".rb",
  ".pl",
  ".sql",
  ".html",
  ".css",
  ".ini",
  ".cfg",
  ".env",
  ".conf",
]);
type JsonRecord = Record<string, unknown>;
type ReadResult = { report: ValidationResult; snapshot: SkillSnapshot | null };
type SourceFile = { absolute: string; relative: string; data: Buffer; mode: number };

class ValidationFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly file?: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function freshReport(): ValidationResult {
  return {
    valid: false,
    errors: [],
    warnings: [],
    files: [],
    dependencies: [],
    compatibility: {
      agent_skills: false,
      independent: false,
      notes: [
        "Static eligibility is not proof of independent execution; dynamic references and undeclared dependencies require review.",
        "Host loading, allowed-tools support and runtime permissions vary; no automatic installation or execution is performed.",
      ],
    },
  };
}

function diagnostic(code: string, message: string, file?: string): Diagnostic {
  return file === undefined ? { code, message } : { code, message, file };
}

function analysisLimit(report: ValidationResult): void {
  const item = diagnostic(
    "ANALYSIS_LIMIT",
    "Static analysis exceeds the 100-entry reference, dependency or diagnostic limit. Reduce the selected Skill's references and dependencies before retrying.",
  );
  if (report.errors.some((entry) => entry.code === item.code)) return;
  if (report.errors.length >= CONTENT_ANALYSIS_LIMIT) report.errors[CONTENT_ANALYSIS_LIMIT - 1] = item;
  else report.errors.push(item);
}

function addError(report: ValidationResult, code: string, message: string, file?: string): void {
  const item = diagnostic(code, message, file);
  if (report.errors.some((entry) => entry.code === code && entry.file === file && entry.message === message)) return;
  if (report.errors.length >= CONTENT_ANALYSIS_LIMIT) {
    analysisLimit(report);
    return;
  }
  report.errors.push(item);
}

function addWarning(report: ValidationResult, item: Diagnostic): void {
  if (
    report.warnings.some(
      (entry) => entry.code === item.code && entry.file === item.file && entry.message === item.message,
    )
  )
    return;
  if (report.warnings.length >= CONTENT_ANALYSIS_LIMIT) {
    analysisLimit(report);
    return;
  }
  report.warnings.push(item);
}

function failureResult(error: unknown): ReadResult {
  const report = freshReport();
  if (error instanceof ValidationFailure) {
    const trustedFile = ["SKILL.md", "skill.json", "config.json"].includes(error.file || "") ? error.file : undefined;
    report.errors.push(diagnostic(error.code, error.message, trustedFile));
  } else {
    const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
    report.errors.push(
      diagnostic(
        code === "EACCES" || code === "EPERM" ? "PERMISSION_DENIED" : "SOURCE_READ_FAILED",
        "Cannot read the selected Skill. Check file permissions and Hub integrity.",
      ),
    );
  }
  return { report, snapshot: null };
}

async function requireRealDirectory(dir: string): Promise<void> {
  const full = path.resolve(dir);
  let current = path.parse(full).root;
  for (const segment of full.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink())
      throw new ValidationFailure(
        "SYMLINK_NOT_ALLOWED",
        "Replace symlink ancestors with real directories before validating.",
      );
    if (!stat.isDirectory()) throw new ValidationFailure("UNSAFE_PATH", "Skill ancestors must be real directories.");
  }
}

async function readSourceFile(absolute: string, relative: string): Promise<SourceFile> {
  try {
    await requireRealDirectory(path.dirname(absolute));
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT")
      throw new ValidationFailure(
        relative === "skill.json" ? "SKILL_NOT_FOUND" : "RESOURCE_NOT_FOUND",
        "A required Skill or resource file is missing. Repair the selected source reference before retrying.",
        relative,
      );
    throw error;
  }
  let stat;
  try {
    stat = await fs.lstat(absolute);
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      throw new ValidationFailure(
        relative === "skill.json" ? "SKILL_NOT_FOUND" : "RESOURCE_NOT_FOUND",
        "A required Skill or resource file is missing. Repair the selected source reference before retrying.",
        relative,
      );
    }
    throw error;
  }
  if (stat.isSymbolicLink())
    throw new ValidationFailure("SYMLINK_NOT_ALLOWED", "Symlinks are not included in portable Skills.", relative);
  if (!stat.isFile())
    throw new ValidationFailure("UNSAFE_FILE_TYPE", "Only regular files can be included in a Skill.", relative);
  if (stat.size > PORTABILITY_LIMITS.file_bytes)
    throw new ValidationFailure("FILE_TOO_LARGE", "A file exceeds the 1 MiB portability limit.", relative);
  const handle = await fs.open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (opened.ino !== stat.ino || opened.dev !== stat.dev)
      throw new ValidationFailure("SNAPSHOT_CHANGED", "Skill changed while reading; retry validation.", relative);
    if (opened.size > PORTABILITY_LIMITS.file_bytes)
      throw new ValidationFailure("FILE_TOO_LARGE", "A file exceeds the 1 MiB portability limit.", relative);
    const buffer = Buffer.allocUnsafe(PORTABILITY_LIMITS.file_bytes + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const { bytesRead } = await handle.read(buffer, bytes, buffer.length - bytes, bytes);
      if (bytesRead === 0) break;
      bytes += bytesRead;
    }
    const after = await handle.stat();
    if (bytes > PORTABILITY_LIMITS.file_bytes)
      throw new ValidationFailure("FILE_TOO_LARGE", "A file exceeds the 1 MiB portability limit.", relative);
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs)
      throw new ValidationFailure("SNAPSHOT_CHANGED", "Skill changed while reading; retry validation.", relative);
    // Copy the used portion so small resources do not retain the 1 MiB read buffer.
    const data = Buffer.from(buffer.subarray(0, bytes));
    return { absolute, relative, data, mode: stat.mode & 0o777 };
  } finally {
    await handle.close();
  }
}

function decodeText(data: Buffer, file: string): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    if (text.includes("\0")) throw Error("nul");
    return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  } catch {
    throw new ValidationFailure("INVALID_ENCODING", "Text files must contain valid UTF-8 without NUL bytes.", file);
  }
}

function parseMetadata(data: Buffer): JsonRecord {
  try {
    const value: unknown = JSON.parse(decodeText(data, "skill.json"));
    if (!isRecord(value)) throw Error("object");
    return value;
  } catch (error) {
    if (error instanceof ValidationFailure) throw error;
    throw new ValidationFailure("INVALID_METADATA", "skill.json must be a valid JSON metadata object.", "skill.json");
  }
}

function validateFrontmatter(value: JsonRecord, skillId: string, report: ValidationResult): void {
  if (
    typeof value.name !== "string" ||
    value.name.length > 64 ||
    !portableName.test(value.name) ||
    value.name !== skillId
  ) {
    addError(
      report,
      "INVALID_NAME",
      "Use the existing directory name: 1–64 lowercase ASCII letters/numbers with single internal hyphens.",
      "SKILL.md",
    );
  }
  if (typeof value.description !== "string" || !value.description.trim() || value.description.length > 1024) {
    addError(report, "INVALID_DESCRIPTION", "Provide a nonempty description of at most 1024 characters.", "SKILL.md");
  }
  const allowed = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key))
      addError(
        report,
        "UNKNOWN_FRONTMATTER_FIELD",
        "Unsupported standard frontmatter field. Move custom fields into metadata.",
        "SKILL.md",
      );
  }
  for (const key of ["license", "allowed-tools"]) {
    if (key in value && (typeof value[key] !== "string" || !value[key].trim()))
      addError(report, "INVALID_FRONTMATTER_FIELD", `${key} must be a nonempty string.`, "SKILL.md");
  }
  if (
    "compatibility" in value &&
    (typeof value.compatibility !== "string" || !value.compatibility.trim() || value.compatibility.length > 500)
  ) {
    addError(
      report,
      "INVALID_COMPATIBILITY",
      "compatibility must be a nonempty string of at most 500 characters.",
      "SKILL.md",
    );
  }
  if (
    "metadata" in value &&
    (!isRecord(value.metadata) || Object.values(value.metadata).some((entry) => typeof entry !== "string"))
  ) {
    addError(report, "INVALID_FRONTMATTER_METADATA", "metadata must map string keys to string values.", "SKILL.md");
  }
  if ("allowed-tools" in value)
    addWarning(
      report,
      diagnostic(
        "EXPERIMENTAL_ALLOWED_TOOLS",
        "allowed-tools is experimental; hosts may ignore it and it does not grant permissions.",
        "SKILL.md",
      ),
    );
}

function renderSkill(content: string, meta: JsonRecord, skillId: string, report: ValidationResult): string {
  let fields: JsonRecord;
  let body: string;
  let header: string;
  if (content.startsWith("---\n") || content === "---") {
    const match = /^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/.exec(content);
    if (!match)
      throw new ValidationFailure("INVALID_YAML", "Close the YAML frontmatter with a standalone --- line.", "SKILL.md");
    const document = parseDocument(match[1]!, { uniqueKeys: true, strict: true });
    let unsupported = false;
    let nonstringKey = false;
    visit(document, (_key, node) => {
      if (isAlias(node) || (node && typeof node === "object" && "tag" in node && node.tag)) unsupported = true;
      if (isPair(node) && (!isScalar(node.key) || typeof node.key.value !== "string")) nonstringKey = true;
    });
    if (document.errors.length || document.warnings.length || unsupported) {
      throw new ValidationFailure(
        "INVALID_YAML",
        "Use valid YAML with unique keys, no aliases and no explicit/custom tags.",
        "SKILL.md",
      );
    }
    if (nonstringKey)
      throw new ValidationFailure(
        "INVALID_FRONTMATTER_METADATA",
        "YAML mappings must use string keys; quote numeric keys and replace complex keys with strings.",
        "SKILL.md",
      );
    const parsed: unknown = document.toJS({ maxAliasCount: 0 });
    if (!isRecord(parsed))
      throw new ValidationFailure("INVALID_YAML", "YAML frontmatter must be a mapping.", "SKILL.md");
    fields = parsed;
    body = match[2]!;
    header = `---\n${match[1]}\n---\n`;
  } else {
    fields = { name: meta.name, description: meta.description };
    body = content;
    header = `---\nname: ${skillId}\ndescription: ${JSON.stringify(meta.description)}\n---\n`;
    addWarning(
      report,
      diagnostic(
        "FRONTMATTER_RENDERED",
        "Standard frontmatter was rendered from existing Skill metadata; the source is unchanged.",
        "SKILL.md",
      ),
    );
  }
  validateFrontmatter(fields, skillId, report);
  if (!body.trim())
    addError(
      report,
      "EMPTY_BODY",
      "Add actionable Markdown instructions; Usora portability requires a nonempty body.",
      "SKILL.md",
    );
  if (body.split("\n").length > 500)
    addWarning(
      report,
      diagnostic(
        "LONG_BODY",
        "Consider moving reference material out of SKILL.md (recommended fewer than 500 lines).",
        "SKILL.md",
      ),
    );
  // Only normalize boundary newlines; spaces can encode Markdown code blocks
  // and hard line breaks and must survive rendering unchanged.
  let start = 0;
  let end = body.length;
  while (start < end && body.charCodeAt(start) === 10) start++;
  while (end > start && body.charCodeAt(end - 1) === 10) end--;
  return `${header}\n${body.slice(start, end)}\n`;
}

function referencePaths(content: string): { references: string[]; limited: boolean } {
  const refs: string[] = [];
  const seen = new Set<string>();
  let limited = false;
  function add(value: string): boolean {
    if (seen.has(value)) return true;
    if (refs.length >= CONTENT_ANALYSIS_LIMIT) {
      limited = true;
      return false;
    }
    seen.add(value);
    refs.push(value);
    return true;
  }
  let remaining = content.replace(
    /!?\[[^[\]\n]*\]\([ \t]*(<[^<>\n]*>|[^\s()[\]<>]+)(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'))?[ \t]*\)/g,
    (_match, target: string) => {
      add(target.replace(/^<|>$/g, ""));
      return " ";
    },
  );
  if (limited) return { references: refs, limited };
  remaining = remaining.replace(
    /^[ \t]*\[[^[\]\n]+\]:[ \t]*(<[^<>\n]*>|[^\s]+)(?:[ \t]|$)/gm,
    (_match, target: string) => {
      add(target.replace(/^<|>$/g, ""));
      return " ";
    },
  );
  if (limited) return { references: refs, limited };
  remaining = remaining.replace(/`([^`\n]+)`/g, (match, code: string) => {
    const value = code.trim();
    if (/^(?:\.\/)?(?:scripts|references|assets)\//.test(value) && !/\s+-/.test(value)) {
      add(value);
      return " ";
    }
    return match;
  });
  if (limited) return { references: refs, limited };
  remaining = remaining.replace(
    /(["'])((?:\.\/)?(?:scripts|references|assets)\/[^"'\n]+)\1/g,
    (_match, _quote: string, target: string) => {
      add(target);
      return " ";
    },
  );
  if (limited) return { references: refs, limited };
  for (const match of remaining.matchAll(
    /(?:^|[\s"'(<])((?:\.\/)?(?:scripts|references|assets)\/[A-Za-z0-9_./%+@=\-\u0080-\uFFFF]+)(?=$|[\s"')>`,;])/gm,
  )) {
    if (!add(match[1]!)) break;
  }
  return { references: refs, limited };
}

function safeResourcePath(raw: string, file: string, report: ValidationResult): string | null {
  if (!raw || raw.startsWith("#")) return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) && !/^[A-Za-z]:/.test(raw)) {
    if (/^https?:/i.test(raw))
      addWarning(
        report,
        diagnostic(
          "EXTERNAL_REFERENCE",
          "External URL is not downloaded or bundled; target-host access is unverified.",
          file,
        ),
      );
    else
      addError(
        report,
        "UNSAFE_PATH",
        "Only Skill-relative local resources and HTTP(S) reference URLs are supported.",
        file,
      );
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw.split("#", 1)[0]!.split("?", 1)[0]!);
  } catch {
    addError(report, "UNSAFE_PATH", "Resource path contains invalid percent encoding.", file);
    return null;
  }
  if (
    /^[A-Za-z]:|^[/\\]|\\/.test(decoded) ||
    [...decoded].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    /%(?:2e|2f|5c|00)/i.test(decoded)
  ) {
    addError(
      report,
      "UNSAFE_PATH",
      "Use root-relative resource paths without absolute/drive/UNC paths, backslashes or encoded escapes.",
      file,
    );
    return null;
  }
  const segments = decoded.replace(/^\.\//, "").split("/");
  if (segments.some((part) => part === ".." || part === "." || !part || part.includes(":"))) {
    addError(
      report,
      "UNSAFE_PATH",
      "Resource path cannot traverse directories or contain empty/ambiguous segments.",
      file,
    );
    return null;
  }
  if (segments[0] === "SKILL.md" && segments.length === 1) return "SKILL.md";
  if (segments.some((part) => /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    addError(report, "UNSAFE_PATH", "Resource names must avoid Windows reserved names and trailing dots/spaces.", file);
    return null;
  }
  if (!resourceRoots.has(segments[0]!)) {
    addError(
      report,
      "RESOURCE_NOT_ALLOWED",
      "Keep bundled resources under scripts/, references/ or assets/ and reference them from the Skill root.",
      file,
    );
    return null;
  }
  if (
    segments.some((part) =>
      /^(?:\.env(?:\..*)?|\.(?:npmrc|pypirc|netrc|aws|ssh)|credentials?(?:\..*)?|id_(?:rsa|ed25519)|.*\.(?:pem|p12|pfx|key))$/i.test(
        part,
      ),
    )
  ) {
    addError(report, "SENSITIVE_FILE", "Sensitive configuration/key files cannot be included in an export.", file);
    return null;
  }
  return segments.join("/");
}

async function collectOnce(dir: string, skillId: string): Promise<{ result: ReadResult; originals: SourceFile[] }> {
  const report = freshReport();
  const originals: SourceFile[] = [];
  await requireRealDirectory(dir);
  const metadata = await readSourceFile(path.join(dir, "skill.json"), "skill.json");
  originals.push(metadata);
  const meta = parseMetadata(metadata.data);
  if (meta.name !== skillId)
    throw new ValidationFailure(
      "INVALID_METADATA",
      "Skill metadata name must match the selected directory.",
      "skill.json",
    );
  if (meta.schema_version !== undefined && meta.schema_version !== 1 && meta.schema_version !== 2)
    throw new ValidationFailure(
      "INVALID_METADATA",
      "Unsupported Skill metadata schema; inspect Hub version before exporting.",
      "skill.json",
    );
  if (meta.state !== "PUBLISHED" || !isRecord(meta.evaluation) || meta.evaluation.result !== "pass")
    throw new ValidationFailure(
      "SKILL_NOT_PUBLISHED",
      "Export requires a PUBLISHED Skill with a passing evaluation. Use the normal review and Maintainer publication workflow.",
      "skill.json",
    );
  if (typeof meta.revision !== "number" || !Number.isSafeInteger(meta.revision) || meta.revision < 1)
    throw new ValidationFailure(
      "INVALID_METADATA",
      "Published Skill must have a positive integer revision.",
      "skill.json",
    );
  const markdown = await readSourceFile(path.join(dir, "SKILL.md"), "SKILL.md");
  originals.push(markdown);
  const rendered = renderSkill(decodeText(markdown.data, "SKILL.md"), meta, skillId, report);
  const renderedData = Buffer.from(rendered, "utf8");
  if (renderedData.length > PORTABILITY_LIMITS.file_bytes)
    addError(report, "FILE_TOO_LARGE", "Rendered SKILL.md exceeds the 1 MiB limit.", "SKILL.md");
  const files: BufferedSkillFile[] = [{ path: "SKILL.md", data: renderedData, mode: 0o644 }];
  const states = new Map<string, "visiting" | "done" | "failed">();
  const caseNames = new Map<string, string>([["skill.md", "SKILL.md"]]);
  const seenReferences = new Set<string>();
  const dependencyKeys = new Set<string>();
  let limited = false;
  let secretDetected = false;
  let totalBytes = renderedData.length;

  function scanContent(content: string, relative: string): void {
    const analysis = analyzeSkillContent(content, relative);
    // Redaction is a security decision, independent of the bounded diagnostic list.
    secretDetected ||= analysis.hasSecrets;
    if (analysis.hasSecrets)
      addError(
        report,
        "SECRET_DETECTED",
        "Potential credential or private key detected. Values are omitted from diagnostics.",
      );
    for (const dependency of analysis.dependencies) {
      const key = `${dependency.kind}\0${dependency.name}`;
      if (dependencyKeys.has(key)) continue;
      if (dependencyKeys.size >= CONTENT_ANALYSIS_LIMIT) {
        limited = true;
        analysisLimit(report);
        break;
      }
      dependencyKeys.add(key);
      report.dependencies.push(dependency);
    }
    if (analysis.limited) {
      limited = true;
      analysisLimit(report);
    }
  }

  async function follow(relative: string, content: string): Promise<void> {
    states.set(relative, "visiting");
    scanContent(content, relative);
    const extracted = referencePaths(content);
    if (extracted.limited) {
      limited = true;
      analysisLimit(report);
    }
    for (const raw of extracted.references) {
      if (limited) break;
      if (!seenReferences.has(raw)) {
        if (seenReferences.size >= CONTENT_ANALYSIS_LIMIT) {
          limited = true;
          analysisLimit(report);
          break;
        }
        seenReferences.add(raw);
      }
      const resource = safeResourcePath(raw, relative, report);
      if (!resource) continue;
      if (states.get(resource) === "visiting") {
        addWarning(
          report,
          diagnostic(
            "CYCLIC_REFERENCE",
            "Cyclic resource reference detected; review host loading order. Each file is included once.",
            relative,
          ),
        );
        continue;
      }
      if (states.has(resource)) continue;
      // Failed paths are visited too, so later documents cannot retry their I/O.
      states.set(resource, "failed");
      const caseKey = resource.normalize("NFC").toLowerCase();
      const previous = caseNames.get(caseKey);
      if (previous && previous !== resource) {
        addError(
          report,
          "DUPLICATE_RESOURCE_NAME",
          "Resource names collide on case-insensitive/Unicode-normalizing filesystems.",
          relative,
        );
        continue;
      }
      caseNames.set(caseKey, resource);
      if (files.length >= PORTABILITY_LIMITS.files) {
        addError(report, "FILE_LIMIT", "A Skill may include at most 100 files.", relative);
        continue;
      }
      try {
        const source = await readSourceFile(path.join(dir, ...resource.split("/")), resource);
        originals.push(source);
        totalBytes += source.data.length;
        if (totalBytes > PORTABILITY_LIMITS.total_bytes) {
          addError(report, "TOTAL_SIZE_LIMIT", "Skill resources exceed the 16 MiB total limit.", resource);
          break;
        }
        files.push({ path: resource, data: source.data, mode: source.mode & 0o111 ? 0o755 : 0o644 });
        if (textExtensions.has(path.posix.extname(resource).toLowerCase()) || resource.startsWith("scripts/")) {
          await follow(resource, decodeText(source.data, resource));
        } else {
          scanContent(source.data.toString("utf8").replaceAll("\0", ""), resource);
          states.set(resource, "done");
        }
      } catch (error) {
        if (!(error instanceof ValidationFailure)) throw error;
        addError(report, error.code, error.message, error.file);
      }
    }
    states.set(relative, "done");
  }

  await follow("SKILL.md", rendered);
  try {
    validateArchivePaths(files.map((file) => `${skillId}/${file.path}`));
  } catch {
    addError(
      report,
      "UNSAFE_PATH",
      "Skill/resource names must be unique and portable across POSIX and Windows filesystems, including reserved names and invalid filename characters.",
    );
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  report.files = files.map((file) => ({
    path: file.path,
    bytes: file.data.length,
    sha256: createHash("sha256").update(file.data).digest("hex"),
  }));
  report.valid = report.errors.length === 0;
  report.compatibility.agent_skills = report.valid;
  report.compatibility.independent = report.valid && !report.dependencies.some((dependency) => dependency.required);
  if (secretDetected) {
    const redacted = freshReport();
    redacted.errors.push(
      diagnostic(
        "SECRET_DETECTED",
        "Potential credential or private key detected. Remove sensitive data from the selected Skill and rotate real credentials before retrying. Source-derived details are omitted.",
      ),
    );
    return { result: { report: redacted, snapshot: null }, originals };
  }
  if (report.dependencies.length)
    addWarning(
      report,
      diagnostic(
        "DEPENDENCIES_REQUIRE_REVIEW",
        "Provision or replace reported dependencies before claiming independent operation.",
      ),
    );
  const snapshot: SkillSnapshot = {
    name: skillId,
    files,
    source: { skill_id: skillId, state: "PUBLISHED", revision: meta.revision },
  };
  return { result: { report, snapshot: report.valid ? snapshot : null }, originals };
}

/** Validate one published Skill directory without writing config, indexes, locks or lifecycle records. */
export async function validateSkillDirectory(dir: string, skillId: string): Promise<ReadResult> {
  if (!portableName.test(skillId) || skillId.length > 64)
    return failureResult(
      new ValidationFailure(
        "INVALID_NAME",
        "Skill identifier must use 1–64 lowercase ASCII letters/numbers with single internal hyphens.",
      ),
    );
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { result, originals } = await collectOnce(path.resolve(dir), skillId);
      for (const original of originals) {
        const current = await readSourceFile(original.absolute, original.relative);
        if (!current.data.equals(original.data) || current.mode !== original.mode)
          throw new ValidationFailure(
            "SNAPSHOT_CHANGED",
            "Skill changed while reading; retry validation.",
            original.relative,
          );
      }
      return result;
    } catch (error) {
      if (error instanceof ValidationFailure && error.code === "SNAPSHOT_CHANGED" && attempt < 2) continue;
      return failureResult(error);
    }
  }
  return failureResult(
    new ValidationFailure("SNAPSHOT_CHANGED", "Skill changed repeatedly; retry when lifecycle writes finish."),
  );
}

/** Resolve the selected user Hub Skill without implicit initialization or schema migration. */
export async function validateSkillSnapshot(skillId: unknown): Promise<ReadResult> {
  if (typeof skillId !== "string" || !skillId)
    return failureResult(new ValidationFailure("INVALID_ARGUMENT", "skill_id is required and must be a string."));
  if (!portableName.test(skillId) || skillId.length > 64)
    return failureResult(
      new ValidationFailure(
        "INVALID_NAME",
        "Skill identifier must use 1–64 lowercase ASCII letters/numbers with single internal hyphens.",
      ),
    );
  try {
    let configFile: SourceFile;
    try {
      configFile = await readSourceFile(path.join(anchorHome, "config.json"), "config.json");
    } catch (error) {
      if (
        (error instanceof ValidationFailure && error.code === "RESOURCE_NOT_FOUND") ||
        (isRecord(error) && error.code === "ENOENT")
      )
        throw new ValidationFailure(
          "HUB_NOT_FOUND",
          "Initialize the Hub explicitly with hub_init before validating a Skill.",
        );
      throw error;
    }
    let config: unknown;
    try {
      config = JSON.parse(decodeText(configFile.data, "config.json"));
    } catch {
      throw new ValidationFailure(
        "INVALID_METADATA",
        "Hub config.json is malformed; inspect hub_doctor before exporting.",
        "config.json",
      );
    }
    if (!isRecord(config))
      throw new ValidationFailure("INVALID_METADATA", "Hub config.json must contain an object.", "config.json");
    const schema = config.hub_schema_version ?? config.version ?? 1;
    if (typeof schema !== "number" || schema < HUB_SCHEMA_VERSION)
      throw new ValidationFailure(
        "MIGRATION_REQUIRED",
        "Hub schema v1 requires an explicit hub_migrate dry_run and confirmed migration before portability tools.",
      );
    if (schema > HUB_SCHEMA_VERSION)
      throw new ValidationFailure(
        "UNSUPPORTED_HUB_SCHEMA",
        "Hub schema is newer than this runtime; upgrade the plugin before exporting.",
      );
    const dir = path.join(await knowledgeDirPath("skills"), skillId);
    try {
      await requireRealDirectory(dir);
    } catch (error) {
      if (isRecord(error) && error.code === "ENOENT")
        throw new ValidationFailure(
          "SKILL_NOT_FOUND",
          "Selected Skill does not exist; use skill_query with a targeted filter.",
        );
      throw error;
    }
    const writerLock = path.join(await knowledgeDirPath("indexes"), "locks", "skills.lock");
    async function requireNoWriter(): Promise<void> {
      const lock = await fs.lstat(writerLock).catch((error: unknown) => {
        if (isRecord(error) && error.code === "ENOENT") return null;
        throw error;
      });
      if (lock)
        throw new ValidationFailure(
          "SOURCE_BUSY",
          "A Skill lifecycle writer holds the skills lock; retry after it completes. No lock is removed by validation.",
        );
    }
    await requireNoWriter();
    const result = await validateSkillDirectory(dir, skillId);
    await requireNoWriter();
    const currentConfig = await readSourceFile(configFile.absolute, configFile.relative);
    if (!currentConfig.data.equals(configFile.data))
      throw new ValidationFailure("SNAPSHOT_CHANGED", "Hub configuration changed during validation; retry the read.");
    return result;
  } catch (error) {
    return failureResult(error);
  }
}
