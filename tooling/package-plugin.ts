import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { discoverPlugins } from "./discover-plugins";

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

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name: Buffer, file: Buffer): Buffer {
  const out = Buffer.alloc(30);
  out.writeUInt32LE(0x04034b50, 0);
  out.writeUInt16LE(20, 4);
  out.writeUInt16LE(0, 6);
  out.writeUInt16LE(0, 8);
  out.writeUInt16LE(0, 10);
  out.writeUInt16LE(0x5b7d, 12);
  out.writeUInt32LE(crc32(file), 14);
  out.writeUInt32LE(file.length, 18);
  out.writeUInt32LE(file.length, 22);
  out.writeUInt16LE(name.length, 26);
  return out;
}

function centralHeader(name: Buffer, file: Buffer, offset: number): Buffer {
  const out = Buffer.alloc(46);
  out.writeUInt32LE(0x02014b50, 0);
  out.writeUInt16LE(20, 4);
  out.writeUInt16LE(20, 6);
  out.writeUInt16LE(0, 8);
  out.writeUInt16LE(0, 10);
  out.writeUInt16LE(0, 12);
  out.writeUInt16LE(0x5b7d, 14);
  out.writeUInt32LE(crc32(file), 16);
  out.writeUInt32LE(file.length, 20);
  out.writeUInt32LE(file.length, 24);
  out.writeUInt16LE(name.length, 28);
  out.writeUInt32LE(offset, 42);
  return out;
}

async function zipDir(source: string, archive: string): Promise<string> {
  const files: string[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else files.push(full);
    }
  }
  await walk(source);

  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const filePath of files) {
    const name = Buffer.from(path.relative(path.dirname(source), filePath).replaceAll("\\", "/"));
    const file = await readFile(filePath);
    const local = localHeader(name, file);
    chunks.push(local, name, file);
    central.push(centralHeader(name, file, offset), name);
    offset += local.length + name.length + file.length;
  }

  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(archive, Buffer.concat([...chunks, ...central, end]));
  return createHash("sha256")
    .update(await readFile(archive))
    .digest("hex");
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
  const distributed = JSON.parse(await readFile(path.join(stage, "package.json"), "utf8")) as {
    dependencies?: unknown;
  };
  if (distributed.dependencies)
    throw Error(`${plugin.manifest.name} distribution package.json must not declare dependencies`);
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
