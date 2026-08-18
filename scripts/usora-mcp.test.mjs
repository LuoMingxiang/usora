import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

/**
 * Spawn the MCP server, send the given requests, and return parsed responses.
 *
 * @param {string} cwd - Working directory for the server process.
 * @param {object[]} requests - JSON-RPC requests.
 * @param {Record<string, string>} [env] - Extra environment variables.
 * @returns {Promise<object[]>}
 */
async function run(cwd, requests, env = {}) {
  const child = spawn(process.execPath, [path.resolve("scripts/usora-mcp.mjs")], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(text) : reject(Error(`server exited ${code}`))));
    child.stdin.end(requests.map(JSON.stringify).join("\n") + "\n");
  });
  return output.trim().split("\n").map(JSON.parse);
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } },
};

test("hub_init uses the default .usora directory and merges activities", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const requests = [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "activity_capture",
        arguments: { session_id: "test-session", task: "test", result: "created", key_points: ["created"] },
      },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "activity_capture",
        arguments: { session_id: "test-session", task: "test", result: "updated", key_points: ["updated"] },
      },
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "skill_create", arguments: { name: "../escape", content: "# invalid" } },
    },
  ];
  const responses = await run(cwd, requests);

  const init = JSON.parse(responses[1].result.content[0].text);
  assert.equal(init.hub, path.join(cwd, ".usora"));
  assert.equal(init.initialized, true);

  assert.match(responses[4].error.message, /letters, numbers, and hyphens/);

  const [file] = await readdir(path.join(cwd, ".usora", "activities"));
  const activity = JSON.parse(await readFile(path.join(cwd, ".usora", "activities", file), "utf8"));
  assert.equal(activity.result, "updated");
  assert.deepEqual(activity.key_points, ["created", "updated"]);
  assert.equal(activity.updates.length, 2);
});

test("hub_init uses host plugin data when CodeBuddy provides it", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-cwd-"));
  const pluginData = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-data-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  t.after(() => rm(pluginData, { recursive: true, force: true }));

  const responses = await run(
    cwd,
    [initialize, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } }],
    { CODEBUDDY_PLUGIN_DATA: pluginData },
  );

  const init = JSON.parse(responses[1].result.content[0].text);
  assert.equal(init.hub, path.join(pluginData, ".usora"));
  await access(path.join(pluginData, ".usora", "config.json"));
  await assert.rejects(access(path.join(cwd, ".usora")));
});

test("hub_config with path moves data to the new directory and clears the old one", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const newDir = path.join(cwd, "relocated");
  const requests = [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { session_id: "s1", task: "t", result: "r", key_points: ["k1"] } },
    },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "hub_config", arguments: { path: newDir } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "hub_status", arguments: {} } },
  ];
  const responses = await run(cwd, requests);

  const relocate = JSON.parse(responses[3].result.content[0].text);
  assert.equal(relocate.hub, newDir);
  assert.equal(relocate.moved_from, path.join(cwd, ".usora"));

  // The Activity must now live under the new directory.
  const [file] = await readdir(path.join(newDir, "activities"));
  const activity = JSON.parse(await readFile(path.join(newDir, "activities", file), "utf8"));
  assert.equal(activity.result, "r");

  // The old directory's activities sub-directory must be cleared away.
  await assert.rejects(access(path.join(cwd, ".usora", "activities")));

  // hub_status must report the new location.
  const status = JSON.parse(responses[4].result.content[0].text);
  assert.equal(status.hub, newDir);
  assert.equal(status.activities, 1);
  assert.equal(status.next_action, "create_candidate");

  // The anchor config must survive (it holds hub_path).
  await access(path.join(cwd, ".usora", "config.json"));
});

test("hub_status suggests the next lifecycle action from counts", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const requests = [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hub_status", arguments: {} } },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { session_id: "s1", task: "t", result: "r" } },
    },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "hub_status", arguments: {} } },
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "candidate_create",
        arguments: { title: "Reusable pattern", summary: "A pattern worth reviewing." },
      },
    },
    { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "hub_status", arguments: {} } },
    {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "skill_create", arguments: { name: "reusable-pattern", content: "# Reusable Pattern" } },
    },
    { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "hub_status", arguments: {} } },
  ];
  const responses = await run(cwd, requests);

  assert.equal(JSON.parse(responses[2].result.content[0].text).next_action, "capture_activity");
  assert.equal(JSON.parse(responses[4].result.content[0].text).next_action, "create_candidate");
  assert.equal(JSON.parse(responses[6].result.content[0].text).next_action, "create_skill");
  assert.equal(JSON.parse(responses[8].result.content[0].text).next_action, "review_or_cleanup");
});

test("skill_list returns recent Skill metadata without content", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const requests = [
    initialize,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "skill_create",
        arguments: { name: "first-skill", content: "# First", description: "First test skill" },
      },
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "skill_create", arguments: { name: "second-skill", content: "# Second" } },
    },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "skill_list", arguments: { limit: 1 } } },
  ];
  const responses = await run(cwd, requests);

  const list = JSON.parse(responses[3].result.content[0].text);
  assert.equal(list.count, 2);
  assert.equal(list.skills.length, 1);
  assert.equal(list.skills[0].name, "second-skill");
  assert.equal(list.skills[0].content, undefined);
});

test("read-side tools complete the Hub lifecycle view", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const requests = [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { session_id: "s1", task: "Build docs", result: "captured" } },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "candidate_create",
        arguments: { title: "Docs loop", summary: "Reusable docs improvement loop." },
      },
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "skill_create", arguments: { name: "docs-loop", content: "# Docs Loop" } },
    },
    { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "activity_list", arguments: {} } },
    { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "candidate_list", arguments: {} } },
    { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "skill_read", arguments: { name: "docs-loop" } } },
    { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "event_list", arguments: { limit: 2 } } },
    { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "hub_doctor", arguments: {} } },
  ];
  const responses = await run(cwd, requests);

  const activities = JSON.parse(responses[5].result.content[0].text);
  assert.equal(activities.count, 1);
  assert.equal(activities.activities[0].task, "Build docs");

  const candidates = JSON.parse(responses[6].result.content[0].text);
  assert.equal(candidates.count, 1);
  assert.equal(candidates.candidates[0].title, "Docs loop");

  const skill = JSON.parse(responses[7].result.content[0].text);
  assert.equal(skill.metadata.name, "docs-loop");
  assert.equal(skill.metadata.content, undefined);
  assert.equal(skill.content, "# Docs Loop\n");

  const events = JSON.parse(responses[8].result.content[0].text);
  assert.equal(events.count, 3);
  assert.equal(events.events.length, 2);

  const doctor = JSON.parse(responses[9].result.content[0].text);
  assert.equal(doctor.ok, true);
  assert.equal(doctor.counts.activities, 1);
  assert.equal(doctor.counts.candidates, 1);
  assert.equal(doctor.counts.skills, 1);
});

test("plugin_cache_cleanup is exposed and safe outside installed cache", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "plugin_cache_cleanup", arguments: {} } },
  ]);

  const toolNames = responses[1].result.tools.map((tool) => tool.name);
  assert.ok(toolNames.includes("plugin_cache_cleanup"));

  const cleanup = JSON.parse(responses[2].result.content[0].text);
  assert.equal(cleanup.ok, false);
  assert.equal(cleanup.action, "not_installed_cache");
});
