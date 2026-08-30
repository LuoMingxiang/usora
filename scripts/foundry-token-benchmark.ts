#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const foundryRoot = path.resolve("plugins/foundry");
const mcpScript = path.join(foundryRoot, "dist", "mcp.js");

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  result: { content: Array<{ text: string }> };
};

type LifecycleEvent = {
  type: string;
  data: {
    full_activity_load?: boolean;
    full_skill_load?: boolean;
  };
};

const initialize: JsonRpcRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "foundry-benchmark", version: "1" } },
};

async function run(cwd: string, requests: JsonRpcRequest[]): Promise<JsonRpcResponse[]> {
  const child = spawn(process.execPath, [mcpScript], {
    cwd,
    env: process.env,
    stdio: ["pipe", "pipe", "inherit"],
  });
  const output = await new Promise<string>((resolve, reject) => {
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(text) : reject(Error(`server exited ${code}`))));
    child.stdin.end(requests.map((request) => JSON.stringify(request)).join("\n") + "\n");
  });
  return output
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

function call(id: number, name: string, args: Record<string, unknown> = {}): JsonRpcRequest {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

function text(response: JsonRpcResponse) {
  return response.result.content[0]?.text ?? "";
}

function responseAt(responses: JsonRpcResponse[], index: number) {
  const response = responses.at(index);
  assertResponse(response);
  return response;
}

function assertResponse(response: JsonRpcResponse | undefined): asserts response is JsonRpcResponse {
  if (!response) {
    throw new Error("missing JSON-RPC response");
  }
}

function activityFixtures() {
  const fixtures = [];
  for (let index = 1; index <= 5; index++) {
    fixtures.push({
      session_id: `short-${index}`,
      task: `Short session ${index}`,
      result: "Captured a concise implementation checkpoint.",
      key_points: [`short point ${index}`],
      technologies: ["node"],
    });
  }
  for (let index = 1; index <= 5; index++) {
    fixtures.push({
      session_id: `long-${index}`,
      task: `Long session ${index}: investigate repeated Foundry activity context growth across a realistic workflow`,
      context: "Long transcript reference ".repeat(60),
      result: "Captured decisions, failed attempts, verification details, and follow-up constraints. ".repeat(20),
      key_points: Array.from({ length: 8 }, (_, point) => `long ${index} key point ${point + 1}`),
      approach: ["inspect current flow", "record baseline", "avoid schema changes"],
      technologies: ["node", "bun", "mcp"],
    });
  }
  fixtures.push({
    session_id: "complex-1",
    task: "Complex session with correction, failed attempt, decision, and verification",
    context: "User corrected scope after an initial attempt; assistant verified the final behavior.",
    result: "Rejected recent-only extraction as a future target and preserved current behavior as baseline.",
    key_points: [
      "initial task changed after user correction",
      "first attempt failed validation",
      "final decision requires deterministic baseline",
      "verification must be repeatable",
    ],
    approach: ["capture correction", "capture failure", "capture decision", "capture verification"],
    technologies: ["node", "node:test"],
  });
  return fixtures;
}

async function main() {
  const root = process.env.USORA_BENCHMARK_TMP || (await mkdtemp(path.join(os.tmpdir(), "usora-foundry-benchmark-")));
  const cwd = path.join(root, "workspace");
  await mkdir(cwd, { recursive: true });
  const requests = [initialize, call(2, "hub_init")];
  let id = 3;
  for (const fixture of activityFixtures()) {
    requests.push(call(id++, "activity_capture", fixture));
  }
  requests.push(
    call(id++, "skill_create", {
      name: "baseline-one",
      content: "# Baseline One",
      description: "First baseline skill",
    }),
    call(id++, "skill_create", {
      name: "baseline-two",
      content: "# Baseline Two",
      description: "Second baseline skill",
    }),
    call(id++, "pattern_index"),
    call(id++, "candidate_resolve", {
      title: "Benchmark candidate",
      summary: "Repeated benchmark workflow that should become a Candidate.",
      evidence: ["bench-1", "bench-2"],
      occurrences: 2,
    }),
    call(id++, "activity_list", { limit: 20 }),
    call(id++, "skill_list", {}),
  );

  const responses = await run(cwd, requests);
  const init = JSON.parse(text(responseAt(responses, 1)));
  const candidate = JSON.parse(text(responseAt(responses, -3))).candidate;
  const moreResponses = await run(cwd, [
    initialize,
    call(2, "candidate_evaluate", { id: candidate.id, result: "pass" }),
    call(3, "skill_generate", { candidate_id: candidate.id, name: "benchmark-candidate" }),
    call(4, "event_list", { limit: 100 }),
    call(5, "telemetry_metrics"),
  ]);
  const activityListText = text(responseAt(responses, -2));
  const skillListText = text(responseAt(responses, -1));
  const events = JSON.parse(text(responseAt(moreResponses, -2))).events as LifecycleEvent[];
  const telemetry = JSON.parse(text(responseAt(moreResponses, -1)));
  const runs = events.filter((event) => event.type === "IntelligenceRun").map((event) => event.data);
  const activityFiles = await readdir(path.join(init.hub, "activities"));
  const activitySizes = await Promise.all(
    activityFiles.map(async (file) => (await readFile(path.join(init.hub, "activities", file), "utf8")).length),
  );

  const report = {
    benchmark: "foundry-token-baseline",
    hub: init.hub,
    fixtures: { short_sessions: 5, long_sessions: 5, complex_sessions: 1 },
    activities: {
      count: activitySizes.length,
      average_full_json_chars: Math.round(activitySizes.reduce((sum, size) => sum + size, 0) / activitySizes.length),
      total_full_json_chars: activitySizes.reduce((sum, size) => sum + size, 0),
    },
    activity_list_limit_20_chars: activityListText.length,
    skill_list_chars: skillListText.length,
    telemetry: {
      intelligence_runs: telemetry.runs,
      avg_context_chars: telemetry.avg_context_chars,
      full_activity_loads: runs.filter((run) => run.full_activity_load).length,
      full_skill_loads: runs.filter((run) => run.full_skill_load).length,
      budget_overflows: events.filter((event) => event.type === "ContextBudgetOverflow").length,
      note: telemetry.note,
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!process.env.USORA_BENCHMARK_TMP) {
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
