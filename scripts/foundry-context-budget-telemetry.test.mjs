import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { checkContextBudget } from "../plugins/foundry/src/core/context-budget.mjs";

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
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } },
};

test("context budget reports chars and chars/4 estimates", async () => {
  const budget = await checkContextBudget("candidate_resolver", {
    required: { task: "x".repeat(100) },
    recommended: { matches: [] },
    optional: { evidence: "y" },
  });

  assert.equal(budget.stage, "candidate_resolver");
  assert.ok(budget.required.chars >= 100);
  assert.equal(budget.estimated_tokens, Math.ceil(budget.total_chars / 4));
  assert.equal(budget.overflow, false);
});

test("candidate and skill intelligence runs feed telemetry metrics", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-telemetry-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    call(2, "candidate_resolve", {
      title: "Telemetry candidate",
      summary: "Reusable telemetry flow.",
      evidence: ["a1", "a2"],
      occurrences: 2,
    }),
    call(3, "candidate_resolve", { title: "Dropped telemetry", summary: "Only once.", occurrences: 1 }),
  ]);
  const candidate = payload(responses[1]).candidate;

  const flow = await run(cwd, [
    initialize,
    call(2, "candidate_evaluate", { id: candidate.id, result: "pass" }),
    call(3, "skill_generate", { candidate_id: candidate.id, name: "telemetry-candidate" }),
    call(4, "event_list", { limit: 20 }),
    call(5, "telemetry_metrics"),
  ]);

  const runs = payload(flow[3])
    .events.filter((event) => event.type === "IntelligenceRun")
    .map((event) => event.data);
  assert.ok(runs.some((run) => run.stage === "candidate_resolver" && run.input_chars > 0));
  assert.ok(runs.some((run) => run.stage === "skill_compiler" && run.evidence_loaded === 2));
  assert.ok(runs.every((run) => Number.isInteger(run.estimated_input_tokens)));

  const metrics = payload(flow[4]);
  assert.equal(metrics.runs, 3);
  assert.ok(metrics.candidate_drop_rate > 0);
  assert.ok(metrics.activity_full_load_avoided >= 2);
  assert.match(metrics.note, /chars\/4/);
});

test("tiny context budgets emit overflow events", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-budget-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    call(2, "context_budget", {
      stage: "pattern_judge",
      required: { huge: "x".repeat(3000) },
      recommended: {},
      optional: {},
    }),
    call(3, "event_list", { limit: 5 }),
  ]);

  assert.equal(payload(responses[1]).overflow, true);
  assert.ok(payload(responses[2]).events.some((event) => event.type === "ContextBudgetOverflow"));
});
