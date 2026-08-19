import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const pluginDir = "plugins/foundry";
const pluginRoot = path.join(root, pluginDir);
const semver = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

async function json(file) {
  return JSON.parse(await readFile(path.join(root, file), "utf8"));
}

async function exists(file) {
  await access(path.join(root, file));
}

function pluginEntry(marketplace) {
  const entry = marketplace.plugins.find((plugin) => plugin.name === "foundry");
  assert.ok(entry, "marketplace must include the foundry plugin");
  return entry;
}

const codex = await json(path.join(pluginDir, ".codex-plugin/plugin.json"));
const codebuddy = await json(path.join(pluginDir, ".codebuddy-plugin/plugin.json"));
const codebuddyMarketplace = await json(".codebuddy-plugin/marketplace.json");
const agentsMarketplace = await json(".agents/plugins/marketplace.json");
const rootMarketplace = await json("marketplace.json");
const portable = await json(path.join(pluginDir, "plugin.json"));
const pkg = await json("package.json");
const marketplaceTemplate = await json("common/marketplace.json");
const mcp = await json(path.join(pluginDir, ".mcp.json"));
const codebuddyMcp = await json(path.join(pluginDir, ".codebuddy-plugin/mcp.json"));
const codexHooks = await json(path.join(pluginDir, "hooks/codex-hooks.json"));
const codebuddyHooks = await json(path.join(pluginDir, "hooks/codebuddy-hooks.json"));

assert.equal(codex.name, "foundry");
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
assert.equal(marketplaceTemplate.name, "usora");

await exists(path.join(pluginDir, codex.skills));
assert.equal(codex.mcpServers, "./.mcp.json");
assert.equal(codex.hooks, "./hooks/codex-hooks.json");
await exists(path.join(pluginDir, codex.mcpServers));
await exists(path.join(pluginDir, codex.hooks));

assert.deepEqual(codebuddy.skills, ["./skills/usora-skill-hub"]);
assert.equal(codebuddy.mcpServers, "./.codebuddy-plugin/mcp.json");
assert.equal(codebuddy.hooks, "./hooks/codebuddy-hooks.json");
assert.equal(codebuddy.commands, undefined);
await exists(path.join(pluginDir, codebuddy.skills[0]));
await exists(path.join(pluginDir, codebuddy.mcpServers));
await exists(path.join(pluginDir, codebuddy.hooks));
await assert.rejects(access(path.join(pluginRoot, ".codex-plugin/mcp.json")));

assert.match(codexHooks.hooks.SessionEnd[0].hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/session-hook\.mjs/);
assert.match(
  codebuddyHooks.hooks.SessionEnd[0].hooks[0].command,
  /\$\{CODEBUDDY_PLUGIN_ROOT\}\/hooks\/session-hook\.mjs/,
);

assert.equal(mcp.practice.command, "node");
assert.deepEqual(mcp.practice.args, ["scripts/usora-mcp.mjs"]);
assert.equal(mcp.practice.cwd, ".");
await exists(path.join(pluginDir, "scripts/usora-mcp.mjs"));
await exists(path.join(pluginDir, "src/mcp/server.mjs"));
assert.match(await readFile(path.join(pluginRoot, "scripts/usora-mcp.mjs"), "utf8"), /src\/mcp\/server\.mjs/);

assert.equal(codebuddyMcp.mcpServers.practice.command, "node");
assert.deepEqual(codebuddyMcp.mcpServers.practice.args, ["${CODEBUDDY_PLUGIN_ROOT}/scripts/usora-mcp.mjs"]);

assert.equal(codebuddyMarketplace.displayName, "Usora Plugin Marketplace");
assert.equal(codebuddyMarketplace.metadata.version, codex.version);
assert.equal(codebuddyMarketplace.metadata.pluginRoot, undefined);
assert.equal(codebuddyMarketplace.owner.name, "Veyra");
const codebuddyEntry = pluginEntry(codebuddyMarketplace);
assert.equal(codebuddyEntry.version, codex.version);
assert.equal(codebuddyEntry.source, "./plugins/foundry");
assert.equal(codebuddyEntry.author.name, "Veyra");
await exists(codebuddyEntry.source);

for (const marketplace of [agentsMarketplace, rootMarketplace]) {
  const entry = pluginEntry(marketplace);
  assert.equal(entry.source.source, "url");
  assert.equal(entry.source.url, "https://github.com/LuoMingxiang/usora.git");
  assert.equal(entry.source.ref, "master");
  assert.equal(entry.source.path, pluginDir);
}

console.log("Usora doctor OK: canonical manifest + Codex + CodeBuddy + marketplaces");
