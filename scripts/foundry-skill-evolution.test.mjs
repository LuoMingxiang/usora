import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
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
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "evolution-test", version: "1" } },
};

test("skill_evolve patches similar Skills instead of creating duplicates", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-evolve-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const setup = await run(cwd, [
    initialize,
    call(2, "skill_create", {
      name: "browser-validation",
      description: "Reusable browser validation flow",
      content: "# Browser Validation\n",
    }),
    call(3, "candidate_create", {
      title: "Browser validation",
      summary: "Reusable browser validation flow with screenshots.",
      technologies: ["playwright"],
      evidence: ["activity-one"],
      occurrences: 2,
    }),
  ]);
  const candidate = payload(setup[2]);

  const evolvedResponses = await run(cwd, [
    initialize,
    call(2, "candidate_evaluate", { id: candidate.id, result: "pass" }),
    call(3, "skill_evolve", {
      candidate_id: candidate.id,
      changes: { content_append: "## Screenshot Check\nVerify the page before finishing." },
    }),
    call(4, "skill_query"),
    call(5, "skill_get", { name: "browser-validation" }),
    call(6, "event_list", { limit: 20 }),
  ]);

  const evolved = payload(evolvedResponses[2]);
  assert.equal(evolved.name, "browser-validation");
  assert.equal(evolved.revision, 1);
  assert.equal(evolved.source_candidate, candidate.id);
  assert.deepEqual(evolved.source_patterns, []);
  assert.equal(payload(evolvedResponses[3]).count, 1);
  assert.match(payload(evolvedResponses[4]).content, /Screenshot Check/);
  assert.ok(payload(evolvedResponses[5]).events.some((event) => event.type === "SkillEvolved"));
});

test("skill_evolve supports CREATE, NOOP, SPLIT, and MERGE audit paths", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-evolve-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const setup = await run(cwd, [
    initialize,
    call(2, "candidate_create", {
      title: "Fresh formatter",
      summary: "A new formatting workflow.",
      evidence: ["a1", "a2"],
      occurrences: 2,
    }),
  ]);
  const candidate = payload(setup[1]);

  const responses = await run(cwd, [
    initialize,
    call(2, "candidate_evaluate", { id: candidate.id, result: "pass" }),
    call(3, "skill_evolve", { candidate_id: candidate.id, action: "CREATE", name: "fresh-formatter" }),
    call(4, "skill_evolve", { name: "fresh-formatter", action: "NOOP", reason: "already covered" }),
    call(5, "skill_evolve", { name: "fresh-formatter", action: "SPLIT", reason: "scope too broad" }),
    call(6, "skill_evolve", { name: "fresh-formatter", action: "MERGE", target_skill: "other-skill" }),
    call(7, "skill_query"),
    call(8, "event_list", { limit: 20 }),
  ]);

  assert.equal(payload(responses[2]).name, "fresh-formatter");
  assert.equal(payload(responses[6]).count, 1);
  const events = payload(responses[7]).events;
  assert.equal(events.filter((event) => event.type === "SkillEvolutionRecommended").length, 3);
});

test("skill_evolve keeps Candidate gate on create paths", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-evolve-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const setup = await run(cwd, [
    initialize,
    call(2, "candidate_create", { title: "Blocked evolve", summary: "Open candidate.", occurrences: 2 }),
    call(3, "skill_evolve", { action: "CREATE", name: "missing-candidate" }),
  ]);
  const candidate = payload(setup[1]);
  assert.match(setup[2].error.message, /candidate_id is required/);

  const blocked = await run(cwd, [
    initialize,
    call(2, "skill_evolve", { action: "CREATE", candidate_id: candidate.id, name: "blocked-evolve" }),
  ]);
  assert.match(blocked[1].error.message, /passing Candidate evaluation/);
});
