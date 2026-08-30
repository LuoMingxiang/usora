import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { discoverPlugins } from "./discover-plugins";
import { createVersionPlan } from "./version-plugin";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function lastTag(): string | undefined {
  return git(["tag", "--sort=-creatordate"]).split(/\r?\n/).find(Boolean);
}

function changedFiles(): string[] {
  const env = process.env.CHANGED_FILES?.split(/\r?\n/).filter(Boolean);
  if (env?.length) return env;
  return git(["diff", "--name-only", lastTag() || "HEAD~1", "HEAD"])
    .split(/\r?\n/)
    .filter(Boolean);
}

function commitMessages(): string[] {
  const env = process.env.COMMIT_MESSAGES?.split(/\r?\n\r?\n/).filter(Boolean);
  if (env?.length) return env;
  const range = lastTag();
  return git(["log", range ? `${range}..HEAD` : "-20", "--pretty=%B"])
    .split(/\r?\n\r?\n/)
    .filter(Boolean);
}

function commitScopes(messages: string[]): Set<string> {
  const scopes = new Set<string>();
  for (const message of messages) {
    const match = /^[a-z]+(?:\(([^)]+)\))?!?:/i.exec(message.trim());
    if (!match?.[1]) continue;
    for (const scope of match[1].split(",")) scopes.add(scope.trim());
  }
  return scopes;
}

async function packageVersion(root: string, pluginDir: string): Promise<string | null> {
  try {
    const pkg = JSON.parse(await readFile(path.join(root, pluginDir, "package.json"), "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

export async function createReleasePlan(
  options: { root?: string; changed?: string[]; commits?: string[] } = {},
): Promise<{
  changed: string[];
  commit_scopes: string[];
  plugins: { name: string; version: string; tag: string; artifact: string; checksum: string }[];
}> {
  const root = options.root || process.cwd();
  const plugins = await discoverPlugins(root);
  const changed = options.changed || changedFiles();
  const commits = options.commits || commitMessages();
  const scopes = commitScopes(commits);
  const versionPlan = await createVersionPlan({ root, changed, commits });
  const releasable = new Set(versionPlan.plugins.map((plugin) => plugin.name));

  for (const plugin of plugins) {
    const pkgVersion = await packageVersion(root, plugin.dir);
    if (pkgVersion && pkgVersion !== plugin.manifest.version) {
      throw Error(
        `${plugin.manifest.name} version mismatch: plugin.json=${plugin.manifest.version} package.json=${pkgVersion}`,
      );
    }
  }

  return {
    changed,
    commit_scopes: [...scopes].sort(),
    plugins: plugins
      .filter((plugin) => releasable.has(plugin.manifest.name))
      .map((plugin) => ({
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        tag: `${plugin.manifest.name}-v${plugin.manifest.version}`,
        artifact: `artifacts/usora-${plugin.manifest.name}-${plugin.manifest.version}.zip`,
        checksum: `artifacts/usora-${plugin.manifest.name}-${plugin.manifest.version}.sha256`,
      })),
  };
}

if (import.meta.main) console.log(JSON.stringify(await createReleasePlan(), null, 2));
