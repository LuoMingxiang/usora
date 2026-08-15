import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

test("activity_capture writes and merges in the workspace Hub", async t => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const requests = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "activity_capture", arguments: { session_id: "test-session", task: "test", result: "created", key_points: ["created"] } } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "activity_capture", arguments: { session_id: "test-session", task: "test", result: "updated", key_points: ["updated"] } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "skill_create", arguments: { name: "../escape", content: "# invalid" } } }
  ];
  const child = spawn(process.execPath, [path.resolve("plugins/usora/scripts/usora-mcp.mjs")], { cwd, stdio: ["pipe", "pipe", "inherit"] });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    child.stdout.on("data", chunk => { text += chunk; });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve(text) : reject(Error(`server exited ${code}`)));
    child.stdin.end(requests.map(JSON.stringify).join("\n") + "\n");
  });
  const responses = output.trim().split("\n").map(JSON.parse);
  assert.equal(responses[2].result.content[0].type, "text");
  assert.match(responses[3].error.message, /letters, numbers, and hyphens/);
  const [file] = await readdir(path.join(cwd, ".usora", "activities"));
  const activity = JSON.parse(await readFile(path.join(cwd, ".usora", "activities", file), "utf8"));
  assert.equal(activity.result, "updated");
  assert.deepEqual(activity.key_points, ["created", "updated"]);
  assert.equal(activity.updates.length, 2);
});

test("hub_init path relocates data and hub_cleanup(all) empties without deleting dirs", async t => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const dataDir = path.join(cwd, "my-usora-data");
  const requests = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } } },
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: { path: dataDir } } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "activity_capture", arguments: { session_id: "s1", task: "t", result: "r" } } },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "hub_status", arguments: {} } },
    { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "hub_cleanup", arguments: { mode: "all", confirm: true } } }
  ];
  const child = spawn(process.execPath, [path.resolve("plugins/usora/scripts/usora-mcp.mjs")], { cwd, stdio: ["pipe", "pipe", "inherit"] });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    child.stdout.on("data", chunk => { text += chunk; });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve(text) : reject(Error(`server exited ${code}`)));
    child.stdin.end(requests.map(JSON.stringify).join("\n") + "\n");
  });

  const responses = output.trim().split("\n").map(JSON.parse);
  const init = JSON.parse(responses[1].result.content[0].text);
  assert.equal(init.hub, dataDir);
  assert.equal(init.initialized, true);

  // hub_status must report the relocated data dir and count the captured Activity.
  const status = JSON.parse(responses[3].result.content[0].text);
  assert.equal(status.hub, dataDir);
  assert.equal(status.activities, 1);

  const cleanup = JSON.parse(responses[4].result.content[0].text);
  assert.equal(cleanup.mode, "all");
  assert.equal(cleanup.hub, dataDir);

  // After cleanup(all): activity dir exists but is empty, the data dir and
  // the anchor config both survive.
  const activityDir = path.join(dataDir, "activities");
  assert.deepEqual(await readdir(activityDir), []);
  await access(dataDir); // data directory still present
  await access(path.join(cwd, ".usora", "config.json")); // anchor config survives
});
