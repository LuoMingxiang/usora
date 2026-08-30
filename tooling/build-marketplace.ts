import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { discoverPlugins } from "./discover-plugins";

const root = process.cwd();
const check = process.argv.includes("--check");
const out = path.join(root, "artifacts", "marketplace");
const allowed = [
  "dist",
  "skills",
  "hooks",
  "assets",
  "plugin.json",
  ".mcp.json",
  ".codex-plugin",
  ".codebuddy-plugin",
  "package.json",
];

async function copyDistribution(source: string, target: string): Promise<void> {
  await cp(source, target, {
    recursive: true,
    filter: (from) =>
      !from.endsWith(".mjs") &&
      !from.endsWith(".ts") &&
      !from.endsWith(".map") &&
      !from.includes(`${path.sep}src${path.sep}`),
  });
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, "marketplace.json"), path.join(out, "marketplace.json"));

for (const plugin of await discoverPlugins(root)) {
  const target = path.join(out, plugin.dir);
  await mkdir(target, { recursive: true });
  for (const item of allowed) await copyDistribution(path.join(root, plugin.dir, item), path.join(target, item));
  await writeFile(
    path.join(target, "package.json"),
    `${JSON.stringify({ name: `@usora/${plugin.manifest.name}`, version: plugin.manifest.version, type: "module", private: true }, null, 2)}\n`,
  );
}

for (const plugin of await discoverPlugins(root)) {
  const entries = await readdir(path.join(out, plugin.dir));
  for (const entry of entries) {
    if (!allowed.includes(entry)) throw Error(`marketplace distribution contains forbidden item: ${entry}`);
  }
}

console.log(check ? "marketplace distribution clean" : `marketplace distribution built at ${path.relative(root, out)}`);
