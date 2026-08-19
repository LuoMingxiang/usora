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
const marketplaceTemplate = await json("common/marketplace.json");
const mcp = await json(".mcp.json");
const codebuddyMcp = await json(".codebuddy-plugin/mcp.json");
const codexHooks = await json("hooks/codex-hooks.json");
const codebuddyHooks = await json("hooks/codebuddy-hooks.json");

assert.equal(codex.name, "usora");
assert.match(codex.version, semver);
assert.equal(codebuddy.name, codex.name);
assert.equal(codebuddy.version, codex.version);
assert.equal(pkg.version, codex.version);
assert.equal(portable.name, codex.name);
assert.equal(portable.version, codex.version);
assert.equal(portable.repository, "https://github.com/LuoMingxiang/usora");
assert.equal(portable.homepage, "https://github.com/LuoMingxiang/usora");
assert.deepEqual(portable.skills, ["./skills/usora-skill-hub"]);
assert.equal(portable.mcpServers, "./.mcp.json");
assert.equal(portable.author.name, "Veyra");
assert.equal(marketplaceTemplate.owner.name, "Veyra");

await exists(codex.skills);
assert.equal(codex.mcpServers, "./.mcp.json");
assert.equal(codex.hooks, "./hooks/codex-hooks.json");
await exists(codex.mcpServers);
await exists(codex.hooks);

assert.deepEqual(codebuddy.skills, ["./skills/usora-skill-hub"]);
assert.equal(codebuddy.mcpServers, "./.codebuddy-plugin/mcp.json");
assert.equal(codebuddy.hooks, "./hooks/codebuddy-hooks.json");
assert.equal(codebuddy.commands, undefined);
await exists(codebuddy.skills[0]);
await exists(codebuddy.mcpServers);
await exists(codebuddy.hooks);
await assert.rejects(access(path.join(root, ".codex-plugin/mcp.json")));

assert.match(codexHooks.hooks.SessionEnd[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/session-hook\.mjs/);
assert.match(
  codebuddyHooks.hooks.SessionEnd[0].hooks[0].command,
  /\$\{CODEBUDDY_PLUGIN_ROOT\}\/hooks\/session-hook\.mjs/,
);

assert.equal(mcp.hub.command, "node");
assert.deepEqual(mcp.hub.args, ["scripts/usora-mcp.mjs"]);
assert.equal(mcp.hub.cwd, ".");
await exists("scripts/usora-mcp.mjs");
await exists("src/mcp/server.mjs");
assert.match(await readFile(path.join(root, "scripts/usora-mcp.mjs"), "utf8"), /src\/mcp\/server\.mjs/);

assert.equal(codebuddyMcp.mcpServers.hub.command, "node");
assert.deepEqual(codebuddyMcp.mcpServers.hub.args, ["${CODEBUDDY_PLUGIN_ROOT}/scripts/usora-mcp.mjs"]);

assert.equal(codebuddyMarketplace.displayName, "Usora Plugin Marketplace");
assert.equal(codebuddyMarketplace.metadata.version, codex.version);
assert.equal(codebuddyMarketplace.owner.name, "Veyra");
const codebuddyEntry = pluginEntry(codebuddyMarketplace);
assert.equal(codebuddyEntry.version, codex.version);
assert.equal(codebuddyEntry.source, ".");
assert.equal(codebuddyEntry.author.name, "Veyra");
await exists(codebuddyEntry.source);

for (const marketplace of [agentsMarketplace, rootMarketplace]) {
  const entry = pluginEntry(marketplace);
  assert.equal(entry.source.source, "url");
  assert.equal(entry.source.url, "https://github.com/LuoMingxiang/usora.git");
  assert.equal(entry.source.ref, "master");
  assert.equal(entry.source.path, undefined);
}

console.log("Usora doctor OK: canonical manifest + Codex + CodeBuddy + marketplaces");
