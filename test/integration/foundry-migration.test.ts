import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "migration-test", version: "1" } },
};

async function writeV1Hub(cwd) {
  const hub = path.join(cwd, ".usora");
  for (const dir of [
    "activities",
    "candidates",
    "skills/legacy-skill",
    "archive",
    "events",
    "sessions",
    "indexes",
    "backups",
  ]) {
    await mkdir(path.join(hub, dir), { recursive: true });
  }
  await writeFile(
    path.join(hub, "config.json"),
    JSON.stringify({ version: 1, maintainer: "owner", automation_policy: "manual_approval" }),
  );
  await writeFile(
    path.join(hub, "activities", "activity-v1.json"),
    JSON.stringify({ id: "activity-v1", session_id: "s1", task: "legacy", result: "kept" }),
  );
  await writeFile(
    path.join(hub, "candidates", "candidate-v1.json"),
    JSON.stringify({ id: "candidate-v1", title: "Legacy", summary: "Legacy candidate", evidence: ["activity-v1"] }),
  );
  await writeFile(
    path.join(hub, "skills", "legacy-skill", "skill.json"),
    JSON.stringify({ name: "legacy-skill", description: "Legacy skill", content: "# Legacy", state: "DRAFT" }),
  );
  await writeFile(path.join(hub, "skills", "legacy-skill", "SKILL.md"), "# Legacy\n");
  return hub;
}

test("v1 Hub requires explicit migration before v2 writes", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-migration-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const hub = await writeV1Hub(cwd);

  const blocked = await run(cwd, [
    initialize,
    call(2, "hub_init"),
    call(3, "hub_status"),
    call(4, "activity_capture", { session_id: "new", task: "new", result: "blocked" }),
    call(5, "hub_migrate", { dry_run: true }),
  ]);

  assert.equal(payload(blocked[1]).migration_required, true);
  assert.equal(payload(blocked[2]).migration_required, true);
  assert.match(blocked[3].error.message, /migration required/i);
  assert.equal(payload(blocked[4]).dry_run, true);
  assert.equal(payload(blocked[4]).counts.activities, 1);

  const migratedResponses = await run(cwd, [
    initialize,
    call(2, "hub_migrate", { confirm: true }),
    call(3, "hub_migrate", { confirm: true }),
    call(4, "activity_capture", { session_id: "new", task: "new", result: "written" }),
    call(5, "event_list", { limit: 20 }),
  ]);
  const migrated = payload(migratedResponses[1]);
  assert.equal(migrated.migrated, true);
  assert.equal(payload(migratedResponses[2]).migrated, false);
  assert.equal(payload(migratedResponses[3]).task, "new");

  const activity = JSON.parse(await readFile(path.join(hub, "activities", "activity-v1.json"), "utf8"));
  const candidate = JSON.parse(await readFile(path.join(hub, "candidates", "candidate-v1.json"), "utf8"));
  const skill = JSON.parse(await readFile(path.join(hub, "skills", "legacy-skill", "skill.json"), "utf8"));
  assert.equal(activity.schema_version, 2);
  assert.equal(candidate.schema_version, 2);
  assert.deepEqual(candidate.evidence, [{ activity_id: "activity-v1", reason: "" }]);
  assert.equal(skill.schema_version, 2);
  assert.equal(await readFile(path.join(hub, "skills", "legacy-skill", "SKILL.md"), "utf8"), "# Legacy\n");
  assert.equal(JSON.parse(await readFile(path.join(hub, "config.json"), "utf8")).maintainer, "owner");
  assert.ok((await readdir(path.join(hub, "backups"))).some((dir) => dir.startsWith("migration-v1-to-v2-")));
  assert.ok(payload(migratedResponses[4]).events.some((event) => event.type === "HubMigrated"));
});
