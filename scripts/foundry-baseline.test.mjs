import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { transitionActivityState } from "../plugins/foundry/src/core/activities.mjs";
import { buildActivityFingerprint } from "../plugins/foundry/src/core/intelligence/fingerprint.mjs";

const foundryRoot = path.resolve("plugins/foundry");
const mcpScript = path.join(foundryRoot, "scripts", "usora-mcp.mjs");
const sessionHook = path.join(foundryRoot, "hooks", "session-hook.mjs");
const benchmarkScript = path.resolve("scripts/foundry-token-benchmark.mjs");

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "baseline-test", version: "1" } },
};

async function run(cwd, requests, env = {}) {
  const child = spawn(process.execPath, [mcpScript], {
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
  const child = spawn(process.execPath, [sessionHook], {
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

async function readOnlyActivity(hub) {
  const files = await readdir(path.join(hub, "activities"));
  assert.equal(files.length, 1);
  return JSON.parse(await readFile(path.join(hub, "activities", files[0]), "utf8"));
}

test("activity_capture baseline covers merge, process session fallback, and required fields", async (t) => {
  const cwd = await tmpdir("usora-baseline-");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { session_id: "same", task: "first", result: "created" } },
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "activity_capture",
        arguments: { session_id: "same", task: "first", result: "updated", key_points: ["kept"] },
      },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { task: "process scoped", result: "one" } },
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { task: "process scoped", result: "two" } },
    },
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { task: "missing result" } },
    },
  ]);

  assert.equal(JSON.parse(responses[2].result.content[0].text).merged, true);
  assert.match(responses[5].error.message, /task and result are required/);

  const activities = await readdir(path.join(cwd, ".usora", "activities"));
  assert.equal(activities.length, 2);
  const records = await Promise.all(
    activities.map(async (file) => JSON.parse(await readFile(path.join(cwd, ".usora", "activities", file), "utf8"))),
  );
  assert.equal(records.find((item) => item.session_id === "same").result, "updated");
  const processScoped = records.find((item) => item.session_id_source === "mcp_process");
  assert.equal(processScoped.result, "two");
  assert.equal(processScoped.recent_updates.length, 2);
  assert.equal(processScoped.history.update_count, 2);
});

test("candidate, skill, and cleanup lifecycle baseline stays explicit", async (t) => {
  const cwd = await tmpdir("usora-baseline-");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "candidate_create", arguments: { title: "Pattern", summary: "Reusable behavior." } },
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "candidate_evaluate", arguments: { id: "bad/id", result: "pass" } },
    },
  ]);
  const candidate = JSON.parse(responses[1].result.content[0].text);
  assert.equal(candidate.state, "OPEN");
  assert.match(responses[2].error.message, /letters, numbers, and hyphens/);

  const publishFlow = await run(cwd, [
    initialize,
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "candidate_evaluate", arguments: { id: candidate.id, result: "pass", reviewer: "tester" } },
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "skill_create",
        arguments: { name: "pattern-skill", content: "# Pattern Skill", candidate_id: candidate.id },
      },
    },
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "skill_publish", arguments: { name: "pattern-skill" } },
    },
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "skill_evaluate", arguments: { name: "pattern-skill", result: "pass" } },
    },
    {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "skill_publish", arguments: { name: "pattern-skill" } },
    },
    {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "skill_read", arguments: { name: "pattern-skill" } },
    },
    { jsonrpc: "2.0", id: 10, method: "tools/call", params: { name: "skill_list", arguments: {} } },
    { jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "hub_doctor", arguments: {} } },
    { jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "hub_cleanup", arguments: { mode: "all" } } },
  ]);

  assert.equal(JSON.parse(publishFlow[1].result.content[0].text).state, "EVALUATED");
  assert.match(publishFlow[3].error.message, /passing evaluation/);
  assert.equal(JSON.parse(publishFlow[5].result.content[0].text).state, "PUBLISHED");
  assert.equal(JSON.parse(publishFlow[6].result.content[0].text).content, "# Pattern Skill\n");
  assert.equal(JSON.parse(publishFlow[7].result.content[0].text).skills[0].content, undefined);
  assert.equal(JSON.parse(publishFlow[8].result.content[0].text).ok, true);
  assert.match(publishFlow[9].error.message, /confirm=true/);
});

test("hub_cleanup archives only generated activities and preserves v1 fixture shape", async (t) => {
  const cwd = await tmpdir("usora-baseline-");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  await run(cwd, [
    initialize,
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { session_id: "new", task: "new", result: "kept" } },
    },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { session_id: "done", task: "done", result: "archive" } },
    },
  ]);

  const hub = path.join(cwd, ".usora");
  const files = await readdir(path.join(hub, "activities"));
  for (const file of files) {
    const fullPath = path.join(hub, "activities", file);
    const item = JSON.parse(await readFile(fullPath, "utf8"));
    if (item.session_id === "done") {
      item.state = "ABSORBED";
      await writeFile(fullPath, `${JSON.stringify(item, null, 2)}\n`);
    }
  }

  const responses = await run(cwd, [
    initialize,
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "hub_cleanup", arguments: { mode: "generated" } } },
  ]);
  assert.equal(JSON.parse(responses[1].result.content[0].text).archived, 1);
  assert.equal((await readdir(path.join(hub, "activities"))).length, 1);
  assert.equal((await readdir(path.join(hub, "archive"))).length, 1);

  const v1Fixture = {
    id: "activity-v1",
    source: "codex",
    session_id: "v1",
    state: "NEW",
    task: "v1 task",
    result: "v1 result",
    key_points: [],
    updates: [],
  };
  assert.equal(v1Fixture.schema_version, undefined);
  assert.deepEqual(Object.keys(v1Fixture), [
    "id",
    "source",
    "session_id",
    "state",
    "task",
    "result",
    "key_points",
    "updates",
  ]);
});

test("activity intelligence writes compact digest, stable fingerprint, hot context, and state transitions", async (t) => {
  const cwd = await tmpdir("usora-activity-intel-");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const requests = [initialize];
  for (let index = 1; index <= 12; index++) {
    requests.push({
      jsonrpc: "2.0",
      id: index + 1,
      method: "tools/call",
      params: {
        name: "activity_capture",
        arguments: {
          session_id: "intel",
          project: "demo-project",
          task: "Investigate a stable fingerprint for repeated Vue route lifecycle cleanup work",
          result: `Captured update ${index} with enough detail to exercise recent update limits.`,
          key_points: [`key point ${index}`],
          technologies: ["vue-router", "vue"],
        },
      },
    });
  }

  await run(cwd, requests);
  const activity = await readOnlyActivity(path.join(cwd, ".usora"));
  const fullSize = JSON.stringify(activity).length;
  const digestSize = JSON.stringify(activity.digest).length;
  assert.ok(digestSize < fullSize / 2);
  assert.equal(activity.digest.task.length <= 200, true);
  assert.equal(activity.digest.result.length <= 300, true);
  assert.equal(activity.digest.key_points.length, 5);
  assert.equal(activity.digest.metadata, undefined);
  assert.equal(activity.digest.recent_updates, undefined);
  assert.equal(activity.digest.schema_version, 1);
  assert.equal(activity.digest.source, "codex");
  assert.equal(activity.digest.fingerprint_version, 1);
  assert.equal(activity.recent_updates.length, 10);
  assert.equal(activity.history.update_count, 12);
  assert.ok(activity.history.first_seen);
  assert.ok(activity.history.last_seen);
  assert.ok(activity.history.key_points.includes("key point 1"));
  assert.ok(activity.history.key_points.includes("key point 12"));
  assert.equal(activity.fingerprint_version, 1);
  assert.equal(activity.fingerprint, buildActivityFingerprint(activity).value);

  const digests = await run(cwd, [
    initialize,
    {
      jsonrpc: "2.0",
      id: 20,
      method: "tools/call",
      params: { name: "activity_digest_list", arguments: { limit: 20 } },
    },
    { jsonrpc: "2.0", id: 21, method: "tools/call", params: { name: "activity_list", arguments: { limit: 20 } } },
  ]);
  const digestText = digests[1].result.content[0].text;
  const fullText = digests[2].result.content[0].text;
  const digestList = JSON.parse(digestText);
  assert.ok(digestText.length < fullText.length);
  assert.equal(digestList.activities[0].recent_updates, undefined);
  assert.equal(digestList.activities[0].metadata, undefined);

  const stateful = transitionActivityState({ state: "NEW" }, "INDEXED");
  transitionActivityState(stateful, "ABSORBED");
  transitionActivityState(stateful, "ARCHIVED");
  assert.equal(stateful.state, "ARCHIVED");
  assert.throws(() => transitionActivityState(stateful, "NEW"), /invalid Activity state transition/);
  assert.throws(() => transitionActivityState({ state: "NEW" }, "ABSORBED"), /invalid Activity state transition/);
});

test("hub storage schema v2 writes versioned records and keeps v1 reads working", async (t) => {
  const cwd = await tmpdir("usora-schema-v2-");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "hub_init", arguments: {} } },
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hub_status", arguments: {} } },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "activity_capture", arguments: { session_id: "v2", task: "schema", result: "versioned" } },
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "candidate_create", arguments: { title: "Schema pattern", summary: "Versioned candidate." } },
    },
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "skill_create", arguments: { name: "schema-skill", content: "# Schema Skill" } },
    },
    { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "event_list", arguments: {} } },
  ]);

  const init = JSON.parse(responses[1].result.content[0].text);
  assert.equal(init.hub_schema_version, 2);
  for (const dir of ["sessions", "indexes", "backups"]) {
    await access(path.join(init.hub, dir));
  }
  assert.equal(JSON.parse(responses[2].result.content[0].text).hub_schema_version, 2);

  const [activityFile] = await readdir(path.join(init.hub, "activities"));
  const [candidateFile] = await readdir(path.join(init.hub, "candidates"));
  const activity = JSON.parse(await readFile(path.join(init.hub, "activities", activityFile), "utf8"));
  const candidate = JSON.parse(await readFile(path.join(init.hub, "candidates", candidateFile), "utf8"));
  const skill = JSON.parse(await readFile(path.join(init.hub, "skills", "schema-skill", "skill.json"), "utf8"));
  assert.equal(activity.schema_version, 2);
  assert.equal(candidate.schema_version, 2);
  assert.equal(skill.schema_version, 2);

  const events = JSON.parse(responses[6].result.content[0].text).events;
  assert.ok(events.every((event) => event.schema_version === 1));

  await writeFile(
    path.join(init.hub, "activities", "activity-legacy.json"),
    JSON.stringify({ id: "activity-legacy", session_id: "legacy", state: "NEW", task: "legacy", result: "kept" }),
  );
  const legacyList = await run(cwd, [
    initialize,
    { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "activity_list", arguments: { limit: 20 } } },
  ]);
  assert.ok(JSON.parse(legacyList[1].result.content[0].text).activities.some((item) => item.id === "activity-legacy"));
});

test("session hook baseline records relaxed captures and preserves early important messages", async (t) => {
  const cwd = await tmpdir("usora-hook-baseline-");
  const hub = path.join(cwd, "hub");
  const transcriptDir = path.join(cwd, "history", "session");
  const messagesDir = path.join(transcriptDir, "messages");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  await mkdir(path.join(cwd, ".usora"), { recursive: true });
  await mkdir(messagesDir, { recursive: true });
  await writeFile(path.join(cwd, ".usora", "config.json"), JSON.stringify({ hub_path: hub, version: 1 }));

  const messages = [];
  for (let index = 1; index <= 6; index++) {
    messages.push({ id: `u${index}`, role: "user" });
    const text =
      index === 1
        ? "必须保留最早的关键约束"
        : index === 3
          ? "不是刚才那个方向，改成 deterministic compiler"
          : `ordinary follow up message ${index}`;
    await writeFile(
      path.join(messagesDir, `u${index}.json`),
      JSON.stringify({ role: "user", extra: JSON.stringify({ sourceContentBlocks: [{ text }] }) }),
    );
  }
  messages.push({ id: "a1", role: "assistant" });
  await writeFile(
    path.join(messagesDir, "a1.json"),
    JSON.stringify({ role: "assistant", message: JSON.stringify({ content: [{ text: "assistant result" }] }) }),
  );
  await writeFile(path.join(transcriptDir, "index.json"), JSON.stringify({ messages }));

  await runHook(cwd, {
    session_id: "hook-session",
    source: "codebuddy",
    cwd,
    transcript_path: path.join(transcriptDir, "index.json"),
  });
  const activity = await readOnlyActivity(hub);
  assert.equal(activity.task, "必须保留最早的关键约束");
  assert.equal(activity.result, "assistant result");
  assert.ok(activity.key_points.includes("必须保留最早的关键约束"));
  assert.ok(activity.key_points.includes("不是刚才那个方向，改成 deterministic compiler"));
  assert.equal(activity.metadata.enrichment, "compiler");
  assert.deepEqual(activity.history.source_ref, {
    type: "host_transcript",
    path: path.join(transcriptDir, "index.json"),
  });
  const [sessionFile] = await readdir(path.join(hub, "sessions"));
  const sessionRecordText = await readFile(path.join(hub, "sessions", sessionFile), "utf8");
  assert.doesNotMatch(sessionRecordText, /ordinary follow up message 6/);

  const relaxedCwd = await tmpdir("usora-hook-relaxed-");
  t.onTestFinished(() => rm(relaxedCwd, { recursive: true, force: true }));
  await runHook(relaxedCwd, { session_id: "empty", transcript_path: path.join(relaxedCwd, "missing.json") });
  const relaxed = await readOnlyActivity(path.join(relaxedCwd, ".usora"));
  assert.equal(relaxed.task, null);
  assert.equal(relaxed.result, null);
  assert.equal(relaxed.metadata.enrichment, "pending");
});

test("foundry token benchmark reports repeatable baseline dimensions", async (t) => {
  const cwd = await tmpdir("usora-benchmark-test-");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const child = spawn(process.execPath, [benchmarkScript], {
    cwd: path.resolve("."),
    env: { ...process.env, USORA_BENCHMARK_TMP: cwd },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const output = await new Promise((resolve, reject) => {
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(text) : reject(Error(`benchmark exited ${code}`))));
  });

  const report = JSON.parse(output);
  assert.deepEqual(report.fixtures, { short_sessions: 5, long_sessions: 5, complex_sessions: 1 });
  assert.equal(report.activities.count, 11);
  assert.ok(report.activities.average_full_json_chars > 0);
  assert.ok(report.activity_list_limit_20_chars > report.activities.average_full_json_chars);
  assert.ok(report.skill_list_chars > 0);
  assert.ok(report.telemetry.intelligence_runs >= 3);
  assert.ok(report.telemetry.avg_context_chars > 0);
  assert.ok(report.telemetry.full_activity_loads >= 1);
  assert.equal(report.telemetry.full_skill_loads, 0);
  assert.match(report.telemetry.note, /chars\/4/);
  await access(report.hub);
});

async function tmpdir(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}
