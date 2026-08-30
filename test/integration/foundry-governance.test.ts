import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "governance-test", version: "1" } },
};

test("governance_scan finds unused, low-success, duplicate, and stale Skills", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-governance-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const responses = await run(cwd, [
    initialize,
    call(2, "skill_create", { name: "browser-check", description: "Browser validation flow", content: "# Browser" }),
    call(3, "skill_create", {
      name: "browser-check-copy",
      description: "Browser validation flow",
      content: "# Browser Copy",
    }),
    call(4, "skill_create", { name: "low-success", description: "Flaky flow", content: "# Flaky" }),
    call(5, "usage_capture", { skill: "low-success", outcome: "failure" }),
    call(6, "usage_capture", { skill: "low-success", outcome: "partial" }),
    call(7, "governance_scan", { stale_days: 0, duplicate_threshold: 0.5 }),
  ]);

  const types = payload(responses[6]).findings.map((finding) => finding.type);
  assert.ok(types.includes("unused"));
  assert.ok(types.includes("low-success"));
  assert.ok(types.includes("duplicate"));
  assert.ok(types.includes("stale"));
});

test("governance_resolve is auditable and gates destructive actions to Maintainer", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-governance-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const setup = await run(cwd, [
    initialize,
    call(2, "hub_init", { maintainer: "owner" }),
    call(3, "skill_create", { name: "primary-skill", description: "Primary flow", content: "# Primary" }),
    call(4, "skill_create", { name: "duplicate-skill", description: "Primary flow duplicate", content: "# Duplicate" }),
    call(5, "governance_resolve", { skill: "duplicate-skill", action: "MERGE", target_skill: "primary-skill" }),
  ]);
  assert.match(setup[4].error.message, /Maintainer/);

  const resolved = await run(cwd, [
    initialize,
    call(2, "governance_resolve", {
      skill: "duplicate-skill",
      action: "MERGE",
      target_skill: "primary-skill",
      actor: "owner",
      reason: "duplicate",
    }),
    call(3, "governance_resolve", { skill: "primary-skill", action: "KEEP", related_to: "duplicate-skill" }),
    call(4, "skill_graph_validate"),
    call(5, "event_list", { limit: 20 }),
  ]);

  assert.equal(payload(resolved[1]).state, "MERGED");
  assert.equal(payload(resolved[3]).ok, true);
  assert.ok(payload(resolved[4]).events.some((event) => event.type === "GovernanceResolved"));

  const duplicate = JSON.parse(
    await readFile(path.join(cwd, ".usora", "skills", "duplicate-skill", "skill.json"), "utf8"),
  );
  const primary = JSON.parse(await readFile(path.join(cwd, ".usora", "skills", "primary-skill", "skill.json"), "utf8"));
  assert.equal(duplicate.superseded_by, "primary-skill");
  assert.deepEqual(primary.supersedes, ["duplicate-skill"]);
});
