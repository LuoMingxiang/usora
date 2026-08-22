import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

const mcpScript = path.resolve("plugins/foundry/scripts/usora-mcp.mjs");

async function run(cwd, requests) {
  const child = spawn(process.execPath, [mcpScript], { cwd, env: process.env, stdio: ["pipe", "pipe", "inherit"] });
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

function payload(response) {
  return JSON.parse(response.result.content[0].text);
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "usage-test", version: "1" } },
};

test("usage_capture records outcomes and updates Skill metrics", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-usage-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    call(2, "skill_create", { name: "usage-skill", content: "# Usage Skill" }),
    call(3, "usage_capture", { session_id: "s1", skill: "usage-skill", outcome: "success", project: "alpha" }),
    call(4, "usage_capture", { session_id: "s2", skill: "usage-skill", outcome: "partial", project: "alpha" }),
    call(5, "usage_capture", { session_id: "s3", skill: "usage-skill", outcome: "failure", project: "beta" }),
    call(6, "usage_capture", { session_id: "s4", skill: "usage-skill" }),
    call(7, "skill_query", { q: "usage", limit: 1 }),
    call(8, "event_list", { limit: 10 }),
  ]);

  const captured = payload(responses[5]);
  assert.equal(captured.usage.outcome, "unknown");
  assert.equal(captured.skill.usage_count, 4);
  assert.equal(captured.skill.success_count, 1);
  assert.equal(captured.skill.partial_count, 1);
  assert.equal(captured.skill.failure_count, 1);
  assert.deepEqual(captured.skill.projects_used.sort(), ["alpha", "beta"]);

  const summary = payload(responses[6]).skills[0];
  assert.equal(summary.usage_count, 4);
  assert.equal(summary.last_used_at, captured.skill.last_used_at);
  assert.equal((await readdir(path.join(cwd, ".usora", "usage"))).length, 4);
  assert.ok(payload(responses[7]).events.some((event) => event.type === "UsageCaptured"));
});

test("usage_capture validates Skill and outcome", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-usage-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    call(2, "usage_capture", { skill: "missing-skill", outcome: "success" }),
    call(3, "skill_create", { name: "usage-skill", content: "# Usage Skill" }),
    call(4, "usage_capture", { skill: "usage-skill", outcome: "great" }),
  ]);

  assert.match(responses[1].error.message, /Skill not found/);
  assert.match(responses[3].error.message, /outcome must be/);
});
