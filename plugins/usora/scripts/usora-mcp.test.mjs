import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

/**
 * Spawn the MCP server, send the given requests, and return parsed responses.
 * @param {string} cwd - Working directory for the server process.
 * @param {Array<object>} requests - JSON-RPC requests.
 * @returns {Promise<Array<object>>}
 */
async function run(cwd, requests) {
  const child = spawn(process.execPath, [path.resolve("plugins/usora/scripts/usora-mcp.mjs")], { cwd, stdio: ["pipe", "pipe", "inherit"] });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    child.stdout.on("data", chunk => { text += chunk; });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve(text) : reject(Error(`server exited ${code}`)));
    child.stdin.end(requests.map(JSON.stringify).join("\n") + "\n");
  });
  return output.trim().split("\n").map(JSON.parse);
}

const initialize = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } };

test("hub_init uses the default .usora directory and merges activities", async t => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const requests = [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "activity_capture", arguments: { session_id: "test-session", task: "test", result: "created", key_points: ["created"] } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "activity_capture", arguments: { session_id: "test-session", task: "test", result: "updated", key_points: ["updated"] } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "skill_create", arguments: { name: "../escape", content: "# invalid" } } }
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

test("hub_config with path moves data to the new directory and clears the old one", async t => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const newDir = path.join(cwd, "relocated");
  const requests = [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "activity_capture", arguments: { session_id: "s1", task: "t", result: "r", key_points: ["k1"] } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "hub_config", arguments: { path: newDir } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "hub_status", arguments: {} } }
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

test("hub_status suggests the next lifecycle action from counts", async t => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const requests = [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hub_status", arguments: {} } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "activity_capture", arguments: { session_id: "s1", task: "t", result: "r" } } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "hub_status", arguments: {} } },
    { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "candidate_create", arguments: { title: "Reusable pattern", summary: "A pattern worth reviewing." } } },
    { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "hub_status", arguments: {} } },
    { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "skill_create", arguments: { name: "reusable-pattern", content: "# Reusable Pattern" } } },
    { jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "hub_status", arguments: {} } }
  ];
  const responses = await run(cwd, requests);

  assert.equal(JSON.parse(responses[2].result.content[0].text).next_action, "capture_activity");
  assert.equal(JSON.parse(responses[4].result.content[0].text).next_action, "create_candidate");
  assert.equal(JSON.parse(responses[6].result.content[0].text).next_action, "create_skill");
  assert.equal(JSON.parse(responses[8].result.content[0].text).next_action, "review_or_cleanup");
});
