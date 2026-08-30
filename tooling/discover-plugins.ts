import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { validatePluginManifest } from "../packages/plugin-schema/src/index";
import type { DiscoveredPlugin } from "../packages/types/src/index";

export async function discoverPlugins(root = process.cwd()): Promise<DiscoveredPlugin[]> {
  const pluginsRoot = path.join(root, "plugins");
  const entries = await readdir(pluginsRoot, { withFileTypes: true });
  const plugins: DiscoveredPlugin[] = [];
  const names = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join("plugins", entry.name);
    const manifestPath = path.join(dir, "plugin.json");
    const raw = JSON.parse(await readFile(path.join(root, manifestPath), "utf8")) as unknown;
    const manifest = validatePluginManifest(raw);
    if (names.has(manifest.name)) throw Error(`Duplicate plugin name: ${manifest.name}`);
    names.add(manifest.name);
    if (manifest.name !== entry.name) throw Error(`${manifestPath} name must match directory`);

    plugins.push({ dir, manifestPath, manifest });
  }

  return plugins.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}

if (import.meta.main) {
  const plugins = await discoverPlugins();
  if (process.argv.includes("--names")) {
    console.log(JSON.stringify(plugins.map((plugin) => plugin.manifest.name)));
  } else if (process.argv.includes("--json")) {
    console.log(JSON.stringify(plugins, null, 2));
  } else {
    for (const plugin of plugins) console.log(`${plugin.manifest.name}\t${plugin.manifest.version}\t${plugin.dir}`);
  }
}
