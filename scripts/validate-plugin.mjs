import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const plugin = path.join(root, "plugins", "usora");
const manifestPath = path.join(plugin, ".codex-plugin", "plugin.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

assert.equal(manifest.name, "usora");
assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

for (const field of ["skills", "mcpServers"]) {
  if (manifest[field]) {
    await access(path.join(plugin, manifest[field]));
  }
}

for (const entry of ["package.json", "package-lock.json", "node_modules", ".github"]) {
  await assert.rejects(access(path.join(plugin, entry)), undefined, `Dev-only path must stay out of plugin: ${entry}`);
}

console.log(`Plugin manifest OK: ${path.relative(root, manifestPath)}`);
