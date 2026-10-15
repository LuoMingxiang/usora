import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { handleHubCleanup, handleHubInit } from "../../plugins/foundry/src/core/hub.ts";
import { handlePatternIndex, handlePatternQuery } from "../../plugins/foundry/src/core/patterns.ts";
import { hasActivityContent } from "../../plugins/foundry/src/core/intelligence/activity-content.ts";

test("blank guard ignores metadata-only and whitespace-only sessions", () => {
  assert.equal(hasActivityContent({ task: " ", result: null, key_points: [], summary: "SessionEnd captured" }), false);
  assert.equal(hasActivityContent({ task: null, result: null, key_points: ["  "] }), false);
  assert.equal(hasActivityContent({ task: "fix bug" }), true);
  assert.equal(hasActivityContent({ key_points: ["discovered a regression"] }), true);
});

test("blank cleanup archives unreferenced records and preserves candidate evidence and Pattern links", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-blank-"));
  const oldCwd = process.cwd();
  const originalUsoraHome = process.env.USORA_HOME;
  try {
    process.chdir(cwd);
    process.env.USORA_HOME = cwd;
    await handleHubInit();
    const root = path.join(cwd, ".usora");
    await mkdir(path.join(root, "activities"), { recursive: true });
    await mkdir(path.join(root, "candidates"), { recursive: true });
    const put = (id: string, fields: Record<string, unknown>) =>
      writeFile(path.join(root, "activities", `${id}.json`), JSON.stringify({
        id, state: "NEW", project: "same", fingerprint: id.startsWith("blank") ? "empty-hash" : "valid-hash",
        digest: { task: fields.task || "", result: "", key_points: [] }, ...fields,
      }));
    await put("blank-1", { task: null, result: null, key_points: [] });
    await put("blank-protected", { task: null, result: null, key_points: [] });
    await put("valid-1", { task: "Useful result", result: null, key_points: [] });
    await writeFile(path.join(root, "candidates", "candidate-1.json"), JSON.stringify({
      id: "candidate-1", evidence: [{ activity_id: "blank-protected" }, { activity_id: "valid-1" }],
    }));
    const cleaned = await handleHubCleanup({ mode: "blank" });
    assert.equal(cleaned.archived, 1);
    assert.equal(cleaned.protected, 1);
    assert.deepEqual((await readdir(path.join(root, "archive"))).filter((p) => p.endsWith(".json")), ["blank-1.json"]);
    assert.deepEqual((await readdir(path.join(root, "activities"))).sort(), ["blank-protected.json", "valid-1.json"]);
    assert.equal((await handleHubCleanup({ mode: "blank" })).archived, 0);
    await handlePatternIndex({ mode: "rebuild" });
    const patterns = await handlePatternQuery({ eligible: true });
    assert.equal(patterns.count, 0);
    assert.equal(JSON.parse(await readFile(path.join(root, "candidates", "candidate-1.json"), "utf8")).evidence.length, 2);
  } finally {
    process.env.USORA_HOME = originalUsoraHome;
    process.chdir(oldCwd);
    await rm(cwd, { recursive: true, force: true });
  }
});
