import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { discoverPlugins } from "./discover-plugins";
import { deterministicZip, type ZipEntry } from "../packages/shared/src/zip.ts";

const root = process.cwd();
const check = process.argv.includes("--check");
const requested = process.argv.filter((arg) => !arg.startsWith("--")).slice(2);
const plugins = (await discoverPlugins(root)).filter(
  (plugin) => requested.length === 0 || requested.includes(plugin.manifest.name),
);
if (requested.length && plugins.length !== requested.length) throw Error(`Unknown plugin(s): ${requested.join(", ")}`);

const outRoot = path.join(root, "artifacts");
const required = [
  "dist",
  "skills",
  "hooks",
  "assets",
  "plugin.json",
  ".mcp.json",
  ".codex-plugin",
  ".codebuddy-plugin",
];
const forbidden = new Set(["src", "tests", "test", "tooling", "tsconfig.json"]);

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

async function assertNoForbidden(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (
      forbidden.has(entry.name) ||
      entry.name.endsWith(".ts") ||
      entry.name.endsWith(".mjs") ||
      entry.name.endsWith(".map")
    ) {
      throw Error(`forbidden artifact file: ${entry.name}`);
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await assertNoForbidden(full);
  }
}

async function digestDir(dir: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(current: string): Promise<void> {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = path.join(current, entry.name);
      hash.update(path.relative(dir, full).replaceAll("\\", "/"));
      if (entry.isDirectory()) await walk(full);
      else hash.update(await readFile(full));
    }
  }
  await walk(dir);
  return hash.digest("hex");
}

async function zipDir(source: string, archive: string): Promise<string> {
  const entries: ZipEntry[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else
        entries.push({
          path: path.relative(path.dirname(source), full).replaceAll("\\", "/"),
          data: await readFile(full),
          mode: (await stat(full)).mode,
        });
    }
  }
  await walk(source);
  const bytes = deterministicZip(entries);
  await writeFile(archive, bytes);
  return createHash("sha256").update(bytes).digest("hex");
}

for (const plugin of plugins) {
  const pluginRoot = path.join(root, plugin.dir);
  const stage = path.join(outRoot, plugin.manifest.name);
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });

  for (const item of required) {
    const source = path.join(pluginRoot, item);
    if (!(await stat(source).catch(() => null)))
      throw Error(`${plugin.manifest.name} missing distribution item: ${item}`);
    await copyDistribution(source, path.join(stage, item));
  }
  await writeFile(
    path.join(stage, "package.json"),
    `${JSON.stringify({ name: `@usora/${plugin.manifest.name}`, version: plugin.manifest.version, type: "module", private: true }, null, 2)}\n`,
  );
  await assertNoForbidden(stage);
  const checksum = await digestDir(stage);
  if (!check) {
    const archive = path.join(outRoot, `usora-${plugin.manifest.name}-${plugin.manifest.version}.zip`);
    const archiveChecksum = await zipDir(stage, archive);
    await writeFile(
      path.join(outRoot, `usora-${plugin.manifest.name}-${plugin.manifest.version}.sha256`),
      `${archiveChecksum}\n`,
    );
    console.log(`packaged ${plugin.manifest.name} tree=${checksum} archive=${archiveChecksum}`);
  }
}
