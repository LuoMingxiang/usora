import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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

async function run(cwd, requests) {
  const child = spawn(process.execPath, [mcpScript], {
    cwd,
    env: process.env,
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
    activities.every((activity) => activity.state === "INDEXED"),
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
