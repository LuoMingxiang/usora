import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

const mcpScript = path.resolve("plugins/foundry/dist/mcp.js");

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

test("candidate_resolve creates, matches, links patterns, and keeps Skill content out of match results", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-candidate-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  await run(cwd, [initialize, call(2, "hub_init")]);
  await mkdir(path.join(cwd, ".usora", "indexes"), { recursive: true });
  await writeFile(
    path.join(cwd, ".usora", "indexes", "patterns.json"),
    JSON.stringify({
      schema_version: 1,
      patterns: [{ fingerprint: "fp-route", activity_ids: ["a1"], occurrences: 2, state: "OBSERVED" }],
    }),
  );

  const createdResponses = await run(cwd, [
    initialize,
    call(2, "candidate_resolve", {
      title: "Route cleanup",
      summary: "Repeated cleanup for frontend route handlers.",
      technologies: ["vue"],
      pattern_fingerprint: "fp-route",
      occurrences: 2,
      evidence: [{ activity_id: "a1", reason: "same fix" }],
    }),
    call(3, "candidate_resolve", {
      title: "Route cleanup",
      summary: "Repeated cleanup for frontend route handlers.",
      technologies: ["vue"],
      pattern_fingerprint: "fp-route",
      occurrences: 2,
    }),
    call(4, "candidate_list"),
  ]);

  const created = payload(createdResponses[1]);
  assert.equal(created.action, "created");
  assert.equal(created.candidate.resolution, "CREATE");
  assert.deepEqual(created.candidate.evidence, [{ activity_id: "a1", reason: "same fix" }]);
  assert.equal(payload(createdResponses[2]).action, "matched");
  assert.equal(payload(createdResponses[3]).count, 1);

  const index = JSON.parse(await readFile(path.join(cwd, ".usora", "indexes", "patterns.json"), "utf8"));
  assert.equal(index.patterns[0].candidate_id, created.candidate.id);
  assert.equal(index.patterns[0].state, "CANDIDATE");

  const skillResponses = await run(cwd, [
    initialize,
    call(2, "skill_create", {
      name: "shell-json",
      description: "Shell JSON reusable parser",
      content: "# Shell JSON\n",
    }),
    call(3, "candidate_match", {
      title: "Shell JSON reusable parser",
      summary: "Shell JSON reusable parser",
      technologies: ["node"],
      limit: 1,
    }),
  ]);
  const match = payload(skillResponses[2]);
  assert.equal(match.skills[0].name, "shell-json");
  assert.equal(match.skills[0].content, undefined);
});

test("candidate_resolve drops low evidence and skill_create requires passing Candidate evaluation", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-candidate-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    call(2, "candidate_resolve", { title: "One-off fix", summary: "Only happened once.", occurrences: 1 }),
    call(3, "skill_create", { name: "blocked-open", content: "# Blocked", candidate_id: "candidate-missing" }),
    call(4, "candidate_create", { title: "Approved pattern", summary: "Reusable and reviewed.", occurrences: 2 }),
    call(5, "skill_create", { name: "blocked-candidate", content: "# Blocked", candidate_id: "candidate-placeholder" }),
  ]);

  const dropped = payload(responses[1]).candidate;
  assert.equal(dropped.state, "DROPPED");
  assert.match(responses[2].error.message, /Candidate not found/);
  const candidate = payload(responses[3]);
  assert.match(responses[4].error.message, /Candidate not found/);

  const gateResponses = await run(cwd, [
    initialize,
    call(2, "skill_create", { name: "blocked-drop", content: "# Blocked", candidate_id: dropped.id }),
    call(3, "skill_create", { name: "blocked-open", content: "# Blocked", candidate_id: candidate.id }),
    call(4, "candidate_evaluate", { id: candidate.id, result: "pass" }),
    call(5, "skill_create", { name: "approved-pattern", content: "# Approved", candidate_id: candidate.id }),
  ]);

  assert.match(gateResponses[1].error.message, /passing Candidate evaluation/);
  assert.match(gateResponses[2].error.message, /passing Candidate evaluation/);
  assert.equal(payload(gateResponses[4]).source_candidate, candidate.id);

  const rejectedResponses = await run(cwd, [
    initialize,
    call(2, "candidate_create", {
      title: "Rejected route pattern",
      summary: "Do not reuse this route cleanup.",
      fingerprint: "fp-rejected",
      occurrences: 2,
    }),
  ]);
  const rejected = payload(rejectedResponses[1]);
  const rematchResponses = await run(cwd, [
    initialize,
    call(2, "candidate_evaluate", { id: rejected.id, result: "fail" }),
    call(3, "candidate_resolve", {
      title: "Rejected route pattern",
      summary: "Do not reuse this route cleanup.",
      fingerprint: "fp-rejected",
      occurrences: 2,
    }),
    call(4, "candidate_list"),
  ]);

  assert.equal(payload(rematchResponses[2]).action, "created");
  assert.equal(payload(rematchResponses[3]).count, 4);
});
