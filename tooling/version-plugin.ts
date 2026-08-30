import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calculateAffectedPlugins } from "./affected-plugins";
import { discoverPlugins } from "./discover-plugins";

type Bump = "major" | "minor" | "patch";

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function lastTag(pattern?: string): string | undefined {
  return git(["tag", ...(pattern ? ["--list", pattern] : []), "--sort=-creatordate"])
    .split(/\r?\n/)
    .find(Boolean);
}

function changedFilesSince(tag?: string): string[] {
  return git(["diff", "--name-only", tag || "HEAD~1", "HEAD"])
    .split(/\r?\n/)
    .filter(Boolean);
}

function changedFiles(): string[] {
  const env = process.env.CHANGED_FILES?.split(/\r?\n/).filter(Boolean);
  if (env?.length) return env;
  return changedFilesSince(lastTag());
}

function commitMessagesSince(tag?: string): string[] {
  return git(["log", tag ? `${tag}..HEAD` : "-20", "--pretty=%B"])
    .split(/\r?\n\r?\n/)
    .filter(Boolean);
}

function commitMessages(): string[] {
  const env = process.env.COMMIT_MESSAGES?.split(/\r?\n\r?\n/).filter(Boolean);
  if (env?.length) return env;
  return commitMessagesSince(lastTag());
}

function betterBump(left: Bump | null, right: Bump): Bump {
  if (left === "major" || right === "major") return "major";
  if (left === "minor" || right === "minor") return "minor";
  return "patch";
}

function parseCommit(message: string): { bump: Bump | null; scopes: string[] } {
  const match = /^([a-z]+)(?:\(([^)]+)\))?(!)?:/i.exec(message.trim());
  if (!match) return { bump: null, scopes: [] };

  const breaking = Boolean(match[3]) || /\nBREAKING CHANGE:/i.test(message);
  const type = match[1]?.toLowerCase();
  const bump = breaking ? "major" : type === "feat" ? "minor" : type === "fix" || type === "perf" ? "patch" : null;
  const scopes =
    match[2]
      ?.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean) || [];
  return { bump, scopes };
}

function bumpVersion(version: string, bump: Bump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw Error(`Unsupported version: ${version}`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

async function updateJsonVersion(file: string, version: string): Promise<void> {
  const value = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  value.version = version;
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function createVersionPlan(
  options: { root?: string; changed?: string[]; commits?: string[] } = {},
): Promise<{
  changed: string[];
  plugins: { name: string; dir: string; currentVersion: string; nextVersion: string; bump: Bump }[];
}> {
  const root = options.root || process.cwd();
  const plugins = await discoverPlugins(root);
  const pluginNames = new Set(plugins.map((plugin) => plugin.manifest.name));
  const changed = options.changed || changedFiles();
  const bumps = new Map<string, Bump>();

  async function addBumps(commits: string[], affected: Set<string>, onlyPlugin?: string) {
    for (const message of commits) {
      const parsed = parseCommit(message);
      if (!parsed.bump) continue;
      const scopedPlugins = parsed.scopes.filter((scope) => pluginNames.has(scope));
      const targets = scopedPlugins.length ? scopedPlugins : [...affected];
      for (const name of targets) {
        if (!onlyPlugin || name === onlyPlugin) bumps.set(name, betterBump(bumps.get(name) || null, parsed.bump));
      }
    }
  }

  if (options.changed || options.commits) {
    await addBumps(options.commits || commitMessages(), new Set(await calculateAffectedPlugins(changed, root)));
  } else {
    for (const plugin of plugins) {
      const tag = lastTag(`${plugin.manifest.name}-v*`);
      await addBumps(
        commitMessagesSince(tag),
        new Set(await calculateAffectedPlugins(changedFilesSince(tag), root)),
        plugin.manifest.name,
      );
    }
  }

  return {
    changed,
    plugins: plugins
      .filter((plugin) => bumps.has(plugin.manifest.name))
      .map((plugin) => {
        const bump = bumps.get(plugin.manifest.name);
        if (!bump) throw Error(`Missing bump for ${plugin.manifest.name}`);
        return {
          name: plugin.manifest.name,
          dir: plugin.dir,
          currentVersion: plugin.manifest.version,
          nextVersion: bumpVersion(plugin.manifest.version, bump),
          bump,
        };
      }),
  };
}

if (import.meta.main) {
  const write = process.argv.includes("--write");
  const plan = await createVersionPlan();
  for (const plugin of plan.plugins) {
    if (write) {
      await updateJsonVersion(path.join(process.cwd(), plugin.dir, "plugin.json"), plugin.nextVersion);
      await updateJsonVersion(path.join(process.cwd(), plugin.dir, "package.json"), plugin.nextVersion);
    }
  }
  console.log(JSON.stringify(plan, null, 2));
}
