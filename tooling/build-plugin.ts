import { rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { discoverPlugins } from "./discover-plugins";

declare const Bun: {
  build(options: {
    entrypoints: string[];
    format: "esm";
    minify: boolean;
    outdir: string;
    naming: string;
    packages: "bundle";
    sourcemap: "none";
    target: "node";
  }): Promise<{ success: boolean }>;
};

const root = process.cwd();
const requested = process.argv.filter((arg) => !arg.startsWith("--")).slice(2);
const plugins = (await discoverPlugins(root)).filter(
  (plugin) => requested.length === 0 || requested.includes(plugin.manifest.name),
);
if (requested.length && plugins.length !== requested.length) throw Error(`Unknown plugin(s): ${requested.join(", ")}`);

for (const plugin of plugins) {
  const pluginRoot = path.join(root, plugin.dir);
  const dist = path.join(pluginRoot, "dist");
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  const entrypoints = [
    ["mcp", "src/cli/mcp.ts", plugin.manifest.entrypoints.mcp],
    ["sessionHook", "src/hooks/session-hook.ts", plugin.manifest.entrypoints.sessionHook],
  ] as const;

  for (const [name, src, out] of entrypoints) {
    if (!out) continue;
    const result = await Bun.build({
      entrypoints: [path.join(pluginRoot, src)],
      format: "esm",
      minify: false,
      outdir: path.join(pluginRoot, path.dirname(out)),
      naming: path.basename(out),
      packages: "bundle",
      sourcemap: "none",
      target: "node",
    });
    if (!result.success) throw Error(`${plugin.manifest.name} ${name} build failed`);
  }
  console.log(`built ${plugin.manifest.name}`);
}
