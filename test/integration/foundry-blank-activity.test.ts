import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { hasActivityContent } from "../../plugins/foundry/src/core/intelligence/activity-content.ts";

test("blank guard ignores metadata-only and whitespace-only sessions", () => {
  assert.equal(hasActivityContent({ task: " ", result: null, key_points: [], summary: "SessionEnd captured" }), false);
  assert.equal(hasActivityContent({ task: null, result: null, key_points: ["  "] }), false);
  assert.equal(hasActivityContent({ task: "fix bug" }), true);
  assert.equal(hasActivityContent({ key_points: ["discovered a regression"] }), true);
});

test("blank cleanup preserves referenced evidence and updates indexes", async (t) => {
  const { spawn } = await import("node:child_process");
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-blank-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const root = path.join(cwd, ".usora");
  const mcp = path.resolve("plugins/foundry/dist/mcp.js");
  const initialize = { jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "blank-test", version: "1" } } };
  async function call(name: string, args: Record<string, unknown> = {}) {
    const child = spawn(process.execPath, [mcp], {
      cwd, env: { ...process.env, HOME: cwd, USERPROFILE: cwd }, stdio: ["pipe", "pipe", "inherit"],
    });
    const output = await new Promise<string>((resolve, reject) => {
      let data = "";
      child.stdout.on("data", (chunk) => { data += String(chunk); });
      child.once("error", reject);
      child.once("close", (code) => code === 0 ? resolve(data) : reject(Error(`exit ${code}`)));
      child.stdin.end([initialize, { jsonrpc: "2.0", id: 2, method: "tools/call",
        params: { name, arguments: args } }].map(JSON.stringify).join("\\n") + "\\n");
    });
    const result = JSON.parse(output.trim().split("\\n")[1]);
    if (result.error || result.result?.isError) throw Error(JSON.stringify(result));
    return JSON.parse(result.result.content[0].text);
  }
  await call("hub_init");
  const activities = path.join(root, "activities");
  await mkdir(path.join(root, "candidates"), { recursive: true });
  for (const [id, task] of [["blank-1", null], ["blank-protected", null], ["valid-1", "Useful result"]] as const) {
    await writeFile(path.join(activities, `${id}.json`), JSON.stringify({
      id, state: "NEW", project: "same", fingerprint: task ? "valid-hash" : "blank-hash",
      task, result: null, key_points: [], digest: { task: task || "", result: "", key_points: [] },
    }));
  }
  await writeFile(path.join(root, "candidates", "candidate-1.json"),
    JSON.stringify({ id: "candidate-1", evidence: [{ activity_id: "blank-protected" }, { activity_id: "valid-1" }] }));
  const result = await call("hub_cleanup", { mode: "blank" });
  assert.equal(result.archived, 1);
  assert.equal(result.protected, 1);
  assert.deepEqual(await readdir(path.join(root, "archive")), ["blank-1.json"]);
  assert.deepEqual((await readdir(activities)).sort(), ["blank-protected.json", "valid-1.json"]);
  assert.equal((await call("hub_cleanup", { mode: "blank" })).archived, 0);
  assert.equal((await call("pattern_query", { eligible: true })).count, 0);
  assert.equal(JSON.parse(await readFile(path.join(root, "candidates", "candidate-1.json"), "utf8")).evidence.length, 2);
});
