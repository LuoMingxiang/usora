import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

async function json(file) {
  return JSON.parse(await readFile(path.join(root, file), "utf8"));
}

async function exists(file) {
  await access(path.join(root, file));
}

function pluginEntry(marketplace) {
  const entry = marketplace.plugins.find((plugin) => plugin.name === "usora");
  assert.ok(entry, "marketplace must include the usora plugin");
  return entry;
}

const codex = await json(".codex-plugin/plugin.json");
const codebuddy = await json(".codebuddy-plugin/plugin.json");
const codebuddyMarketplace = await json(".codebuddy-plugin/marketplace.json");
const agentsMarketplace = await json(".agents/plugins/marketplace.json");
const rootMarketplace = await json("marketplace.json");
const portable = await json("plugin.json");
const pkg = await json("package.json");
const mcp = await json(".mcp.json");
const codebuddyMcp = await json(".codebuddy-plugin/mcp.json");

assert.equal(codex.name, "usora");
assert.match(codex.version, semver);
assert.equal(codebuddy.name, codex.name);
assert.equal(codebuddy.version, codex.version);
assert.equal(pkg.version, codex.version);
assert.equal(portable.name, codex.name);

await exists(codex.skills);
await exists(codex.mcpServers);

assert.deepEqual(codebuddy.skills, ["./skills/usora-skill-hub"]);
assert.equal(codebuddy.mcpServers, "./.codebuddy-plugin/mcp.json");
assert.equal(codebuddy.commands, undefined);
await exists(codebuddy.skills[0]);
await exists(codebuddy.mcpServers);

assert.equal(mcp.mcpServers.usora.command, "node");
assert.deepEqual(mcp.mcpServers.usora.args, ["scripts/usora-mcp.mjs"]);
assert.equal(mcp.mcpServers.usora.cwd, ".");
await exists("scripts/usora-mcp.mjs");

assert.equal(codebuddyMcp.mcpServers.usora.command, "node");
assert.deepEqual(codebuddyMcp.mcpServers.usora.args, ["${CODEBUDDY_PLUGIN_ROOT}/scripts/usora-mcp.mjs"]);

assert.equal(codebuddyMarketplace.displayName, "Usora Plugin Marketplace");
assert.equal(codebuddyMarketplace.metadata.version, codex.version);
const codebuddyEntry = pluginEntry(codebuddyMarketplace);
assert.equal(codebuddyEntry.version, codex.version);
assert.equal(codebuddyEntry.source, ".");
await exists(codebuddyEntry.source);

for (const marketplace of [agentsMarketplace, rootMarketplace]) {
  const entry = pluginEntry(marketplace);
  assert.equal(entry.source.source, "url");
  assert.equal(entry.source.url, "https://github.com/LuoMingxiang/usora.git");
  assert.equal(entry.source.ref, "master");
  assert.equal(entry.source.path, undefined);
}

console.log("Plugin manifests OK: Codex + CodeBuddy + marketplaces");
