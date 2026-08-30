import { discoverPlugins } from "./discover-plugins";
import { readFile } from "node:fs/promises";
import path from "node:path";

function normalizePath(file: string): string {
  return file.replaceAll("\\", "/").replace(/^\.\//, "");
}

function matchesPluginFile(file: string, pluginDir: string): boolean {
  return file === pluginDir || file.startsWith(`${pluginDir}/`);
}

function isGlobalRuntimeChange(file: string): boolean {
  return /^(tooling|package\.json|bun\.lock|tsconfig(\.|$))/.test(file);
}

function packageNameFromPath(file: string): string | null {
  const match = /^packages\/([^/]+)\//.exec(file);
  return match ? `@usora/${match[1]}` : null;
}

async function readPackageJson(file: string): Promise<Record<string, unknown> | null> {
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function dependencyNames(pkg: Record<string, unknown> | null): Set<string> {
  const names = new Set<string>();
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const deps = pkg?.[field];
    if (!deps || typeof deps !== "object" || Array.isArray(deps)) continue;
    for (const name of Object.keys(deps)) names.add(name);
  }
  return names;
}

export async function calculateAffectedPlugins(changedFiles: string[], root = process.cwd()): Promise<string[]> {
  const plugins = await discoverPlugins(root);
  const allNames = plugins.map((plugin) => plugin.manifest.name);
  const pluginDeps = new Map<string, Set<string>>();
  for (const plugin of plugins) {
    pluginDeps.set(
      plugin.manifest.name,
      dependencyNames(await readPackageJson(path.join(root, plugin.dir, "package.json"))),
    );
  }
  const affected = new Set<string>();

  for (const file of changedFiles.map(normalizePath)) {
    const plugin = plugins.find((item) => matchesPluginFile(file, normalizePath(item.dir)));
    if (plugin) {
      affected.add(plugin.manifest.name);
      continue;
    }

    const packageName = packageNameFromPath(file);
    if (packageName) {
      let matched = false;
      for (const [pluginName, deps] of pluginDeps) {
        if (deps.has(packageName)) {
          affected.add(pluginName);
          matched = true;
        }
      }
      if (!matched) for (const name of allNames) affected.add(name);
      continue;
    }

    if (isGlobalRuntimeChange(file)) {
      for (const name of allNames) affected.add(name);
    }
  }

  return [...affected].sort();
}

if (import.meta.main) {
  const changed = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const result = await calculateAffectedPlugins(changed);
  console.log(process.argv.includes("--json") ? JSON.stringify(result) : result.join("\n"));
}
