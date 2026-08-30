import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

const mcpScript = path.resolve("plugins/foundry/dist/mcp.js");

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pattern-test", version: "1" } },
};

async function run(cwd, requests, env = {}) {
  const child = spawn(process.execPath, [mcpScript], {
    cwd,
    env: { ...process.env, HOME: cwd, USERPROFILE: cwd, ...env },
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

function call(id, name, args = {}) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

function body(response) {
  return JSON.parse(response.result.content[0].text);
}

test("pattern_index is incremental, idempotent, eligible-aware, and rebuildable", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-patterns-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  await run(cwd, [
    initialize,
    call(2, "hub_init"),
    call(3, "activity_capture", {
      session_id: "same-1",
      project: "project-a",
      task: "Fix Vue route lifecycle cleanup",
      result: "Use route leave lifecycle",
      technologies: ["Vue", "vue-router"],
    }),
    call(4, "activity_capture", {
      session_id: "same-2",
      project: "project-a",
      task: "vue route lifecycle cleanup fix",
      result: "Use route leave lifecycle again",
      technologies: ["vue-router", "vue"],
    }),
    call(5, "activity_capture", {
      session_id: "single",
      project: "project-b",
      task: "Write standalone docs",
      result: "Docs captured",
      technologies: ["markdown"],
    }),
    call(6, "activity_capture", {
      session_id: "routine",
      project: "project-b",
      task: "Routine dependency bump",
      result: "Routine maintenance captured",
      technologies: ["node"],
      metadata: { type: "routine" },
    }),
    call(7, "activity_capture", {
      session_id: "high-value",
      project: "project-c",
      task: "One-off security safety rule",
      result: "High value safety rule captured",
      technologies: ["security"],
      metadata: { high_value: true },
    }),
  ]);

  const first = await run(cwd, [initialize, call(8, "pattern_index")]);
  assert.deepEqual(body(first[1]), { mode: "incremental", indexed: 5, patterns: 4 });

  const second = await run(cwd, [initialize, call(9, "pattern_index")]);
  assert.deepEqual(body(second[1]), { mode: "incremental", indexed: 0, patterns: 4 });

  const eligible = await run(cwd, [initialize, call(10, "pattern_query", { eligible: true })]);
  const eligiblePatterns = body(eligible[1]).patterns;
  assert.equal(eligiblePatterns.length, 2);
  assert.ok(eligiblePatterns.some((pattern) => pattern.occurrences === 2 && pattern.projects === 1));
  assert.ok(eligiblePatterns.some((pattern) => pattern.high_value === true && pattern.occurrences === 1));
  assert.equal(
    eligiblePatterns.some((pattern) => pattern.type === "routine"),
    false,
  );

  const hub = path.join(cwd, ".usora");
  const activityFiles = await readdir(path.join(hub, "activities"));
  const activities = await Promise.all(
    activityFiles.map(async (file) => JSON.parse(await readFile(path.join(hub, "activities", file), "utf8"))),
  );
  assert.equal(
    activities.every((activity) => activity.state === "NEW"),
    true,
  );

  await writeFile(
    path.join(hub, "activities", "activity-legacy.json"),
    JSON.stringify({ id: "activity-legacy", session_id: "legacy", state: "NEW", task: "legacy", result: "kept" }),
  );
  const rebuild = await run(cwd, [initialize, call(11, "pattern_index", { mode: "rebuild" })]);
  assert.deepEqual(body(rebuild[1]), { mode: "rebuild", indexed: 5, patterns: 4 });

  const index = JSON.parse(await readFile(path.join(hub, "indexes", "patterns.json"), "utf8"));
  const occurrences = index.patterns.map((pattern) => pattern.occurrences).sort();
  assert.deepEqual(occurrences, [1, 1, 1, 2]);
});

test("pattern_index aggregates Codex and CodeBuddy Activity without mutating either source", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-multi-host-"));
  const codebuddyHome = path.join(cwd, "codebuddy-home");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  await run(cwd, [initialize, call(2, "hub_init")]);
  const codexActivity = {
    id: "activity-codex-001",
    source: "codex",
    state: "NEW",
    fingerprint: "fingerprint-X",
    fingerprint_version: 1,
    project: "codex-project",
    started_at: "2026-08-30T01:00:00.000Z",
    updated_at: "2026-08-30T01:00:00.000Z",
    digest: { domain: "engineering", topic: "shared knowledge", type: "implementation" },
  };
  const codebuddyActivity = {
    id: "activity-codebuddy-001",
    source: "codebuddy",
    state: "NEW",
    fingerprint: "fingerprint-X",
    fingerprint_version: 1,
    project: "codebuddy-project",
    started_at: "2026-08-30T01:00:00.000Z",
    updated_at: "2026-08-30T01:00:00.000Z",
    digest: { domain: "engineering", topic: "shared knowledge", type: "implementation" },
  };
  await writeFile(
    path.join(cwd, ".usora", "activities", "activity-codex-001.json"),
    `${JSON.stringify(codexActivity, null, 2)}\n`,
  );
  await mkdir(path.join(codebuddyHome, "activities"), { recursive: true });
  const codebuddyFile = path.join(codebuddyHome, "activities", "activity-codebuddy-001.json");
  await writeFile(codebuddyFile, `${JSON.stringify(codebuddyActivity, null, 2)}\n`);
  const codebuddyBefore = await readFile(codebuddyFile, "utf8");

  const first = await run(cwd, [initialize, call(3, "pattern_index")], { USORA_CODEBUDDY_HOME: codebuddyHome });
  assert.deepEqual(body(first[1]), { mode: "incremental", indexed: 2, patterns: 1 });

  const index = JSON.parse(await readFile(path.join(cwd, ".usora", "indexes", "patterns.json"), "utf8"));
  const pattern = index.patterns[0];
  assert.equal(pattern.fingerprint, "fingerprint-X");
  assert.equal(pattern.occurrences, 2);
  assert.deepEqual(pattern.source_hosts.sort(), ["codebuddy", "codex"]);
  assert.deepEqual(pattern.activity_refs.map((ref) => `${ref.source}:${ref.id}`).sort(), [
    "codebuddy:activity-codebuddy-001",
    "codex:activity-codex-001",
  ]);
  assert.equal(await readFile(codebuddyFile, "utf8"), codebuddyBefore);

  const second = await run(cwd, [initialize, call(4, "pattern_index")], { USORA_CODEBUDDY_HOME: codebuddyHome });
  assert.deepEqual(body(second[1]), { mode: "incremental", indexed: 0, patterns: 1 });
});

test("CodeBuddy-triggered pattern_index reads Codex Activity", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-codebuddy-trigger-"));
  const codebuddyPluginData = path.join(cwd, "codebuddy-plugin-data");
  const codexHome = path.join(cwd, "codex-home");
  const knowledgeHome = path.join(cwd, "knowledge");
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  await mkdir(path.join(codexHome, "activities"), { recursive: true });
  await writeFile(
    path.join(codexHome, "activities", "activity-codex-001.json"),
    JSON.stringify({
      id: "activity-codex-001",
      state: "NEW",
      fingerprint: "fingerprint-reverse",
      digest: { topic: "reverse" },
      updated_at: "2026-08-30T02:00:00.000Z",
    }),
  );
  await run(
    cwd,
    [
      initialize,
      call(2, "hub_init"),
      call(3, "activity_capture", {
        session_id: "codebuddy",
        source: "codebuddy",
        task: "reverse host aggregation",
        result: "same pattern",
      }),
    ],
    { CODEBUDDY_PLUGIN_DATA: codebuddyPluginData, USORA_HOME: knowledgeHome, USORA_CODEX_HOME: codexHome },
  );
  const [codebuddyFile] = await readdir(path.join(codebuddyPluginData, ".usora", "activities"));
  const codebuddyActivityPath = path.join(codebuddyPluginData, ".usora", "activities", codebuddyFile);
  const codebuddyActivity = JSON.parse(await readFile(codebuddyActivityPath, "utf8"));
  codebuddyActivity.fingerprint = "fingerprint-reverse";
  codebuddyActivity.digest = { topic: "reverse" };
  await writeFile(codebuddyActivityPath, JSON.stringify(codebuddyActivity));

  const indexed = await run(cwd, [initialize, call(4, "pattern_index")], {
    CODEBUDDY_PLUGIN_DATA: codebuddyPluginData,
    USORA_HOME: knowledgeHome,
    USORA_CODEX_HOME: codexHome,
  });
  assert.deepEqual(body(indexed[1]), { mode: "incremental", indexed: 2, patterns: 1 });
});

test("pattern_index keeps same-timestamp Activity evidence and concurrent runs idempotent", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-pattern-boundary-"));
  const codebuddyHome = path.join(cwd, "codebuddy-home");
  const timestamp = "2026-08-30T03:00:00.000Z";
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  await run(cwd, [initialize, call(2, "hub_init")]);
  await mkdir(path.join(codebuddyHome, "activities"), { recursive: true });
  for (const [root, id] of [
    [path.join(cwd, ".usora"), "activity-codex-boundary"],
    [codebuddyHome, "activity-codebuddy-boundary"],
  ]) {
    await writeFile(
      path.join(root, "activities", `${id}.json`),
      JSON.stringify({
        id,
        state: "NEW",
        fingerprint: "fingerprint-boundary",
        digest: { topic: "boundary" },
        started_at: timestamp,
        updated_at: timestamp,
      }),
    );
  }

  await Promise.all([
    run(cwd, [initialize, call(3, "pattern_index")], { USORA_CODEBUDDY_HOME: codebuddyHome }),
    run(cwd, [initialize, call(4, "pattern_index")], { USORA_CODEBUDDY_HOME: codebuddyHome }),
  ]);
  const index = JSON.parse(await readFile(path.join(cwd, ".usora", "indexes", "patterns.json"), "utf8"));
  assert.equal(index.patterns[0].occurrences, 2);
  assert.equal(index.patterns[0].activity_refs.length, 2);
});
