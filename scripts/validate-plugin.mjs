import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const plugin = root;
const manifestPath = path.join(plugin, ".codex-plugin", "plugin.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const portableManifestPath = path.join(plugin, "plugin.json");
const codebuddyManifestPath = path.join(plugin, ".codebuddy-plugin", "plugin.json");
const codebuddyMarketplacePath = path.join(root, ".codebuddy-plugin", "marketplace.json");
const agentsMarketplacePath = path.join(root, ".agents", "plugins", "marketplace.json");

assert.equal(manifest.name, "usora");
assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

for (const field of ["skills", "mcpServers"]) {
  if (manifest[field]) {
    await access(path.join(plugin, manifest[field]));
  }
}

const codebuddyManifest = JSON.parse(await readFile(codebuddyManifestPath, "utf8"));
const codebuddyMarketplace = JSON.parse(await readFile(codebuddyMarketplacePath, "utf8"));
const portableManifest = JSON.parse(await readFile(portableManifestPath, "utf8"));
const agentsMarketplace = JSON.parse(await readFile(agentsMarketplacePath, "utf8"));
assert.equal(portableManifest.name, manifest.name);
assert.equal(codebuddyManifest.name, manifest.name);
assert.equal(codebuddyManifest.version, manifest.version);
assert.equal(codebuddyMarketplace.displayName, "Usora Plugin Marketplace");
assert.equal(codebuddyMarketplace.metadata.version, manifest.version);
for (const field of ["skills"]) {
  assert.ok(Array.isArray(codebuddyManifest[field]), `CodeBuddy manifest must declare ${field}`);
  for (const entry of codebuddyManifest[field]) {
    await access(path.join(root, entry));
  }
}
assert.equal(codebuddyManifest.mcpServers, "./.mcp.json");
await access(path.join(root, codebuddyManifest.mcpServers));
assert.equal(codebuddyMarketplace.plugins[0].name, manifest.name);
assert.equal(codebuddyMarketplace.plugins[0].version, manifest.version);
await access(path.join(root, codebuddyMarketplace.plugins[0].source));
assert.equal(agentsMarketplace.plugins[0].name, manifest.name);
assert.equal(agentsMarketplace.plugins[0].source.url, "https://github.com/LuoMingxiang/usora.git");

console.log(`Plugin manifest OK: ${path.relative(root, manifestPath)}`);
