import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

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

test("query/get APIs keep default reads compact and allow targeted full reads", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-query-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    call(2, "activity_capture", { session_id: "s1", task: "Build query", result: "Captured full Activity" }),
    call(3, "activity_query", {}),
    call(4, "candidate_create", { title: "Query candidate", summary: "Compact Candidate query.", tags: ["query"] }),
    call(5, "candidate_query", { fields: ["id", "title"] }),
    call(6, "skill_create", { name: "query-skill", content: "# Query Skill", description: "Compact Skill query" }),
    call(7, "skill_query", { q: "query", limit: 1, fields: ["name", "description"] }),
    call(8, "skill_get", { name: "query-skill" }),
  ]);

  const activity = payload(responses[2]).activities[0];
  assert.equal(activity.recent_updates, undefined);
  assert.equal(activity.history, undefined);
  assert.equal(activity.task, "Build query");

  const candidate = payload(responses[4]).candidates[0];
  assert.deepEqual(Object.keys(candidate).sort(), ["id", "title"]);

  const skillSummary = payload(responses[6]).skills[0];
  assert.equal(skillSummary.name, "query-skill");
  assert.deepEqual(Object.keys(skillSummary).sort(), ["description", "name"]);
  assert.equal(skillSummary.content, undefined);
  assert.equal(payload(responses[7]).content, "# Query Skill\n");
});

test("skill_generate requires a passing Candidate and uses bounded metadata-only context", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-skillgen-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));

  await run(cwd, [initialize, call(2, "hub_init")]);
  await mkdir(path.join(cwd, ".usora", "indexes"), { recursive: true });
  await writeFile(
    path.join(cwd, ".usora", "indexes", "patterns.json"),
    JSON.stringify({
      schema_version: 1,
      patterns: [{ fingerprint: "fp-skillgen", activity_ids: ["a1"], occurrences: 4, state: "CANDIDATE" }],
    }),
  );

  const setup = await run(cwd, [
    initialize,
    call(2, "skill_create", {
      name: "similar-skill",
      description: "Reusable browser validation metadata",
      content: "# Similar Skill\nThis full content should stay out of query results.",
    }),
    call(3, "candidate_create", {
      title: "Browser validation",
      summary: "Reusable browser validation flow.",
      fingerprint: "fp-skillgen",
      occurrences: 4,
      evidence: ["a1", "a2", "a3", "a4"],
    }),
  ]);
  const candidate = payload(setup[2]);

  const blocked = await run(cwd, [initialize, call(2, "skill_generate", { candidate_id: candidate.id })]);
  assert.match(blocked[1].error.message, /passing Candidate evaluation/);

  const generatedResponses = await run(cwd, [
    initialize,
    call(2, "candidate_evaluate", { id: candidate.id, result: "pass" }),
    call(3, "skill_generate", { candidate_id: candidate.id, name: "browser-validation" }),
    call(4, "skill_query", { candidate_id: candidate.id }),
    call(5, "skill_index", { mode: "rebuild" }),
    call(6, "skill_evaluate", { name: "browser-validation", result: "pass" }),
    call(7, "skill_publish", { name: "browser-validation" }),
    call(8, "skill_query", { state: "PUBLISHED" }),
    call(9, "skill_get", { name: "browser-validation" }),
    call(10, "pattern_get", { fingerprint: "fp-skillgen", fields: ["fingerprint", "state"] }),
  ]);

  const generated = payload(generatedResponses[2]);
  assert.equal(generated.source_candidate, candidate.id);
  assert.equal(generated.generation.evidence_loaded, 3);
  assert.equal(generated.generation.full_activity_load, false);
  assert.equal(generated.generation.full_skill_load, false);

  const metadataOnly = payload(generatedResponses[3]).skills[0];
  assert.equal(metadataOnly.content, undefined);
  assert.equal(metadataOnly.source_candidate, candidate.id);
  assert.ok(payload(generatedResponses[4]).count >= 2);
  assert.equal(payload(generatedResponses[7]).skills[0].name, "browser-validation");

  const full = payload(generatedResponses[8]).content;
  assert.match(full, /a1/);
  assert.match(full, /a3/);
  assert.doesNotMatch(full, /a4/);
  assert.deepEqual(payload(generatedResponses[9]), { fingerprint: "fp-skillgen", state: "CANDIDATE" });
});
