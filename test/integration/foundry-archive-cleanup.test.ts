import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

const script = path.resolve("plugins/foundry/dist/mcp.js");
async function fixture(t: { onTestFinished: (fn: () => Promise<void>) => void }) {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-archive-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const root = path.join(cwd, ".usora");
  for (const dir of ["archive", "activities", "candidates", "skills"])
    await mkdir(path.join(root, dir), { recursive: true });
  async function json(file: string, value: unknown) {
    const dest = path.join(root, file);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, JSON.stringify(value));
  }
  function call(confirm = false) {
    const requests = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "archive-test", version: "1" } },
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "hub_cleanup", arguments: { mode: "archive", confirm } },
      },
    ];
    const child = spawnSync(process.execPath, [script], {
      cwd,
      env: {
        ...process.env,
        HOME: cwd,
        USERPROFILE: cwd,
        USORA_HOME: root,
        CODEBUDDY_PLUGIN_DATA: "",
        CODEBUDDY_PLUGIN_ROOT: "",
        CLAUDE_PLUGIN_ROOT: "",
        PLUGIN_DATA: "",
      },
      input: requests.map(JSON.stringify).join("\n") + "\n",
      encoding: "utf8",
    });
    assert.equal(child.status, 0, child.stderr);
    const response = JSON.parse(child.stdout.trim().split("\n")[1]);
    assert.ok(!response.error && !response.result?.isError, JSON.stringify(response));
    return JSON.parse(response.result.content[0].text);
  }
  return { root, json, call };
}

test("archive cleanup previews then deletes only unreferenced archived Activities", async (t) => {
  const { root, json, call } = await fixture(t);
  for (const id of ["free", "candidate-ref", "skill-ref", "string-ref"])
    await json(`archive/${id}.json`, { id, task: "useful" });
  await json("candidates/nested/c.json", { evidence: [{ activity_id: "candidate-ref" }, "string-ref"] });
  await json("skills/s/skill.json", { evolution: [{ evidence: [{ activity_id: "skill-ref" }] }] });
  await json("activities/active.json", { id: "active" });
  await writeFile(path.join(root, "archive", "broken.json"), "{");
  await symlink(path.join(root, "activities", "active.json"), path.join(root, "archive", "link.json"));
  const preview = call();
  assert.equal(preview.dry_run, true);
  assert.equal(preview.eligible, 1);
  assert.equal(preview.deleted, 0);
  assert.equal(preview.protected, 3);
  assert.equal(preview.skipped, 2);
  assert.equal((await readdir(path.join(root, "archive"))).length, 6);
  const deleted = call(true);
  assert.equal(deleted.deleted, 1);
  assert.equal(deleted.dry_run, false);
  assert.equal((await readdir(path.join(root, "archive"))).length, 5);
  assert.equal(JSON.parse(await readFile(path.join(root, "activities", "active.json"), "utf8")).id, "active");
  assert.equal(call(true).deleted, 0);
});

test("archive cleanup refuses deletion when reference JSON is malformed", async (t) => {
  const { root, json, call } = await fixture(t);
  await json("archive/free.json", { id: "free" });
  await writeFile(path.join(root, "candidates", "broken.json"), "{");
  assert.throws(() => call(true), /reference/i);
  assert.deepEqual(await readdir(path.join(root, "archive")), ["free.json"]);
});

test("archive cleanup skips non-record JSON and directories and protects legacy evidence IDs", async (t) => {
  const { root, json, call } = await fixture(t);
  await json("archive/keep.json", { id: "keep" });
  await json("skills/s/skill.json", { evidence: [{ id: "keep" }] });
  await json("archive/array.json", []);
  await json("archive/missing-id.json", { task: "unknown record" });
  await mkdir(path.join(root, "archive", "directory.json"));
  const result = call(true);
  assert.equal(result.deleted, 0);
  assert.equal(result.protected, 1);
  assert.equal(result.skipped, 3);
});

test("archive cleanup aborts on reference symlinks", async (t) => {
  const { root, json, call } = await fixture(t);
  await json("archive/free.json", { id: "free" });
  await symlink(path.join(root, "archive", "free.json"), path.join(root, "skills", "link.json"));
  assert.throws(() => call(true), /reference/i);
  assert.deepEqual(await readdir(path.join(root, "archive")), ["free.json"]);
});

test("archive cleanup refuses a symlinked archive directory", async (t) => {
  const { root, json, call } = await fixture(t);
  await json("activities/keep.json", { id: "keep" });
  await rm(path.join(root, "archive"), { recursive: true });
  await symlink(path.join(root, "activities"), path.join(root, "archive"));
  assert.throws(() => call(true), /symlink/i);
  assert.deepEqual(await readdir(path.join(root, "activities")), ["keep.json"]);
});
