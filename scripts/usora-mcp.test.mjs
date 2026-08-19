import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, access, mkdir, cp, writeFile } from "node:fs/promises";
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

async function runHook(cwd, event) {
  const child = spawn(process.execPath, [path.resolve("hooks/session-hook.mjs")], {
    cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "inherit"],
  });
  await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve() : reject(Error(`hook exited ${code}`))));
    child.stdin.end(`${JSON.stringify(event)}\n`);
  });
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
  assert.equal(init.data_path, path.join(cwd, ".usora"));
  assert.equal(init.initialized, true);
  for (const dir of ["activities", "candidates", "skills", "archive", "events"]) {
    await access(path.join(cwd, ".usora", dir));
  }

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
  assert.equal(init.data_path, path.join(pluginData, ".usora"));
  await access(path.join(pluginData, ".usora", "config.json"));
  await assert.rejects(access(path.join(cwd, ".usora")));
});

test("hub_init avoids the project when only CodeBuddy plugin root is provided", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-cwd-"));
  const home = await mkdtemp(path.join(os.tmpdir(), "usora-home-"));
  const pluginRoot = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-root-"));
  const dataRoot = path.join(home, ".codebuddy", "plugins", "data", "usora", ".usora");
  t.after(() => rm(cwd, { recursive: true, force: true }));
  t.after(() => rm(home, { recursive: true, force: true }));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));

  const responses = await run(
    cwd,
    [initialize, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } }],
    { CODEBUDDY_PLUGIN_ROOT: pluginRoot, CODEBUDDY_PLUGIN_DATA: "", HOME: home, USERPROFILE: home },
  );

  const init = JSON.parse(responses[1].result.content[0].text);
  assert.equal(init.hub, dataRoot);
  assert.equal(init.data_path, dataRoot);
  await assert.rejects(access(path.join(cwd, ".usora")));
});

test("hub_init detects CodeBuddy marketplace installs without env vars", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-cwd-"));
  const home = await mkdtemp(path.join(os.tmpdir(), "usora-home-"));
  const marketplaceRoot = path.join(home, ".codebuddy", "plugins", "marketplaces", "usora-test");
  const dataRoot = path.join(home, ".codebuddy", "plugins", "data", "usora", ".usora");
  await rm(marketplaceRoot, { recursive: true, force: true });
  await mkdir(path.join(marketplaceRoot, "scripts"), { recursive: true });
  await mkdir(path.join(marketplaceRoot, "src"), { recursive: true });
  await cp(path.resolve("scripts/usora-mcp.mjs"), path.join(marketplaceRoot, "scripts", "usora-mcp.mjs"));
  await cp(path.resolve("src"), path.join(marketplaceRoot, "src"), { recursive: true });
  t.after(() => rm(cwd, { recursive: true, force: true }));
  t.after(() => rm(home, { recursive: true, force: true }));

  const child = spawn(process.execPath, [path.join(marketplaceRoot, "scripts", "usora-mcp.mjs")], {
    cwd,
    env: { ...process.env, HOME: home, USERPROFILE: home },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(text) : reject(Error(`server exited ${code}`))));
    child.stdin.end(
      [initialize, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } }]
        .map(JSON.stringify)
        .join("\n") + "\n",
    );
  });

  const responses = output.trim().split("\n").map(JSON.parse);
  const init = JSON.parse(responses[1].result.content[0].text);
  assert.equal(init.hub, dataRoot);
  assert.equal(init.data_path, dataRoot);
  await assert.rejects(access(path.join(cwd, ".usora")));
});

test("hub_init detects Codex cache installs without env vars", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-cwd-"));
  const home = await mkdtemp(path.join(os.tmpdir(), "usora-home-"));
  const pluginRoot = path.join(home, ".codex", "plugins", "cache", "usora", "usora", "0.1.0");
  const dataRoot = path.join(home, ".codex", "plugins", "data", "usora", ".usora");
  await mkdir(path.join(pluginRoot, "scripts"), { recursive: true });
  await mkdir(path.join(pluginRoot, "src"), { recursive: true });
  await cp(path.resolve("scripts/usora-mcp.mjs"), path.join(pluginRoot, "scripts", "usora-mcp.mjs"));
  await cp(path.resolve("src"), path.join(pluginRoot, "src"), { recursive: true });
  t.after(() => rm(cwd, { recursive: true, force: true }));
  t.after(() => rm(home, { recursive: true, force: true }));

  const child = spawn(process.execPath, [path.join(pluginRoot, "scripts", "usora-mcp.mjs")], {
    cwd,
    env: { ...process.env, HOME: home, USERPROFILE: home },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(text) : reject(Error(`server exited ${code}`))));
    child.stdin.end(
      [initialize, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } }]
        .map(JSON.stringify)
        .join("\n") + "\n",
    );
  });

  const responses = output.trim().split("\n").map(JSON.parse);
  const init = JSON.parse(responses[1].result.content[0].text);
  assert.equal(init.hub, dataRoot);
  assert.equal(init.data_path, dataRoot);
  await assert.rejects(access(path.join(pluginRoot, ".usora")));
});

test("hub_init avoids the project when only Claude plugin root is provided", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-cwd-"));
  const home = await mkdtemp(path.join(os.tmpdir(), "usora-home-"));
  const pluginRoot = await mkdtemp(path.join(os.tmpdir(), "usora-claude-root-"));
  const dataRoot = path.join(home, ".codex", "plugins", "data", "usora", ".usora");
  t.after(() => rm(cwd, { recursive: true, force: true }));
  t.after(() => rm(home, { recursive: true, force: true }));
  t.after(() => rm(pluginRoot, { recursive: true, force: true }));

  const responses = await run(
    cwd,
    [initialize, { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } }],
    { CLAUDE_PLUGIN_ROOT: pluginRoot, HOME: home, USERPROFILE: home },
  );

  const init = JSON.parse(responses[1].result.content[0].text);
  assert.equal(init.hub, dataRoot);
  assert.equal(init.data_path, dataRoot);
  await assert.rejects(access(path.join(cwd, ".usora")));
});

test("hub_init migrates legacy plugin-local data into stable host data", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-cwd-"));
  const home = await mkdtemp(path.join(os.tmpdir(), "usora-home-"));
  const pluginRoot = path.join(home, ".codebuddy", "plugins", "marketplaces", "usora-test");
  const legacyHub = path.join(pluginRoot, ".usora");
  const dataRoot = path.join(home, ".codebuddy", "plugins", "data", "usora", ".usora");
  await mkdir(path.join(pluginRoot, "scripts"), { recursive: true });
  await mkdir(path.join(pluginRoot, "src"), { recursive: true });
  await mkdir(path.join(legacyHub, "activities"), { recursive: true });
  await writeFile(
    path.join(legacyHub, "activities", "activity-legacy.json"),
    JSON.stringify({ id: "activity-legacy", task: "legacy", result: "kept" }),
  );
  await writeFile(path.join(legacyHub, "config.json"), JSON.stringify({ maintainer: "codex", version: 1 }));
  await cp(path.resolve("scripts/usora-mcp.mjs"), path.join(pluginRoot, "scripts", "usora-mcp.mjs"));
  await cp(path.resolve("src"), path.join(pluginRoot, "src"), { recursive: true });
  t.after(() => rm(cwd, { recursive: true, force: true }));
  t.after(() => rm(home, { recursive: true, force: true }));

  const child = spawn(process.execPath, [path.join(pluginRoot, "scripts", "usora-mcp.mjs")], {
    cwd,
    env: { ...process.env, HOME: home, USERPROFILE: home },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(text) : reject(Error(`server exited ${code}`))));
    child.stdin.end(
      [
        initialize,
        { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hub_status", arguments: {} } },
      ]
        .map(JSON.stringify)
        .join("\n") + "\n",
    );
  });

  const responses = output.trim().split("\n").map(JSON.parse);
  const status = JSON.parse(responses[2].result.content[0].text);
  assert.equal(status.hub, dataRoot);
  assert.equal(status.data_path, dataRoot);
  const activity = JSON.parse(await readFile(path.join(dataRoot, "activities", "activity-legacy.json"), "utf8"));
  assert.equal(activity.result, "kept");
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
  assert.equal(status.data_path, newDir);
  assert.equal(status.activities, 1);
  assert.equal(status.next_action, "create_candidate");

  // The anchor config must survive (it holds hub_path).
  await access(path.join(cwd, ".usora", "config.json"));
});

test("session hook captures canonical Activity in the configured Hub", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-hook-"));
  const hub = path.join(cwd, "hub");
  t.after(() => rm(cwd, { recursive: true, force: true }));

  await mkdir(path.join(cwd, ".usora"), { recursive: true });
  await writeFile(path.join(cwd, ".usora", "config.json"), JSON.stringify({ hub_path: hub, version: 1 }));

  await runHook(cwd, {
    session_id: "s1",
    cwd,
    timestamp: "not-a-date",
    transcript_path: path.join(cwd, "transcript.jsonl"),
  });
  await runHook(cwd, { session_id: "s1", cwd, timestamp: "2026-08-19T00:00:00Z", task: "Review", result: "Fixed" });

  const files = await readdir(path.join(hub, "activities"));
  assert.equal(files.length, 1);
  const activity = JSON.parse(await readFile(path.join(hub, "activities", files[0]), "utf8"));
  assert.equal(activity.session_id, "s1");
  assert.equal(activity.source, "codex");
  assert.equal(activity.task, "Review");
  assert.equal(activity.result, "Fixed");
  assert.equal(activity.metadata.transcript_path, path.join(cwd, "transcript.jsonl"));
  assert.equal(activity.updates.length, 2);
});

test("session hook extracts a small Activity summary from CodeBuddy transcript files", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-hook-"));
  const hub = path.join(cwd, "hub");
  const transcriptDir = path.join(cwd, "history", "session");
  const messagesDir = path.join(transcriptDir, "messages");
  t.after(() => rm(cwd, { recursive: true, force: true }));

  await mkdir(path.join(cwd, ".usora"), { recursive: true });
  await mkdir(messagesDir, { recursive: true });
  await writeFile(path.join(cwd, ".usora", "config.json"), JSON.stringify({ hub_path: hub, version: 1 }));
  await writeFile(
    path.join(transcriptDir, "index.json"),
    JSON.stringify({
      messages: [
        { id: "u1", role: "user" },
        { id: "a1", role: "assistant" },
        { id: "u2", role: "user" },
        { id: "a2", role: "assistant" },
      ],
    }),
  );
  await writeFile(
    path.join(messagesDir, "u1.json"),
    JSON.stringify({ role: "user", extra: JSON.stringify({ sourceContentBlocks: [{ text: "old task" }] }) }),
  );
  await writeFile(
    path.join(messagesDir, "a1.json"),
    JSON.stringify({ role: "assistant", message: JSON.stringify({ content: [{ text: "old result" }] }) }),
  );
  await writeFile(
    path.join(messagesDir, "u2.json"),
    JSON.stringify({ role: "user", extra: JSON.stringify({ sourceContentBlocks: [{ text: "final task" }] }) }),
  );
  await writeFile(
    path.join(messagesDir, "a2.json"),
    JSON.stringify({ role: "assistant", message: JSON.stringify({ content: [{ text: "final result" }] }) }),
  );

  await runHook(cwd, {
    session_id: "s2",
    source: "codebuddy",
    cwd,
    transcript_path: path.join(transcriptDir, "index.json"),
  });

  const [file] = await readdir(path.join(hub, "activities"));
  const activity = JSON.parse(await readFile(path.join(hub, "activities", file), "utf8"));
  assert.equal(activity.task, "old task");
  assert.equal(activity.result, "final result");
  assert.deepEqual(activity.key_points, ["old task", "final task"]);
  assert.equal(activity.metadata.enrichment, "heuristic");
  assert.equal(activity.updates[0].summary, "final result");
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

test("hub_status works before explicit hub_init", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_status", arguments: {} } },
  ]);

  const status = JSON.parse(responses[1].result.content[0].text);
  assert.equal(status.hub, path.join(cwd, ".usora"));
  assert.equal(status.data_path, path.join(cwd, ".usora"));
  assert.equal(status.activities, 0);
  assert.equal(status.candidates, 0);
  assert.equal(status.skills, 0);
  assert.equal(status.next_action, "capture_activity");
});

test("hub_config returns data_path without relocation", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-mcp-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "hub_config", arguments: { maintainer: "owner" } },
    },
  ]);

  const configOnly = JSON.parse(responses[2].result.content[0].text);
  assert.equal(configOnly.data_path, path.join(cwd, ".usora"));
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
  assert.equal(doctor.data_path, path.join(cwd, ".usora"));
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
