import os from "node:os";
import path from "node:path";
import { currentHostRoot, LocalActivitySource } from "./local-activity-source.ts";

function envPath(name: string): string | null {
  return process.env[name] ? path.resolve(process.env[name]) : null;
}

function codebuddyRoot(): string {
  return path.join(os.homedir(), ".codebuddy", "plugins", "data", "usora", ".usora");
}

function codexRoot(): string {
  return path.join(os.homedir(), ".codex", "plugins", "data", "usora", ".usora");
}

export function currentHost(): "codex" | "codebuddy" {
  return process.env.CODEBUDDY_PLUGIN_DATA || process.env.CODEBUDDY_PLUGIN_ROOT ? "codebuddy" : "codex";
}

export function activitySources() {
  const host = currentHost();
  return [
    new LocalActivitySource(
      host,
      host,
      async () =>
        envPath(host === "codebuddy" ? "USORA_CODEBUDDY_HOME" : "USORA_CODEX_HOME") || (await currentHostRoot()),
    ),
    new LocalActivitySource("codebuddy", "codebuddy", async () => envPath("USORA_CODEBUDDY_HOME") || codebuddyRoot()),
    new LocalActivitySource("codex-home", "codex", async () => envPath("USORA_CODEX_HOME") || codexRoot()),
  ];
}

export async function discoverActivitySources() {
  const seen = new Set<string>();
  const available = [];
  for (const source of activitySources()) {
    const root = await source.root();
    if (!root) continue;
    const key = path.resolve(root).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (await source.discover()) available.push(source);
  }
  return available;
}

export async function describeActivitySources() {
  const seen = new Set<string>();
  const result = [];
  for (const source of activitySources()) {
    const root = await source.root();
    const key = root ? path.resolve(root).toLowerCase() : `${source.id}:missing`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: source.id,
      host: source.host,
      available: await source.discover(),
      root,
      activities: await source.activitiesPath(),
    });
  }
  return result;
}
