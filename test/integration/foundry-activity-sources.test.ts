import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { LocalActivitySource } from "../../plugins/foundry/src/sources/local-activity-source.ts";
import { describeActivitySources, discoverActivitySources } from "../../plugins/foundry/src/sources/registry.ts";

test("LocalActivitySource reads only valid fingerprinted Activity records without mutation", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "usora-source-"));
  const activities = path.join(root, "activities");
  t.onTestFinished(() => rm(root, { recursive: true, force: true }));

  await mkdir(activities, { recursive: true });
  await writeFile(
    path.join(activities, "valid.json"),
    JSON.stringify({ id: "valid", state: "NEW", fingerprint: "fp", digest: { topic: "x" } }),
  );
  await writeFile(path.join(activities, "missing-digest.json"), JSON.stringify({ id: "bad", fingerprint: "fp" }));
  await writeFile(path.join(activities, "invalid.json"), "{");

  const source = new LocalActivitySource("test", "test", async () => root);
  const records = await source.readActivities();
  assert.equal(await source.discover(), true);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.source.id, "test");
  assert.equal(records[0]?.activity.id, "valid");
});

test("Activity Source registry reports CodeBuddy availability without failing missing sources", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "usora-registry-"));
  t.onTestFinished(() => rm(root, { recursive: true, force: true }));
  t.onTestFinished(() => {
    delete process.env.USORA_CODEBUDDY_HOME;
  });

  process.env.USORA_CODEBUDDY_HOME = root;
  await mkdir(path.join(root, "activities"), { recursive: true });
  const described = await describeActivitySources();
  const codebuddy = described.find((source) => source.id === "codebuddy");
  assert.equal(codebuddy?.available, true);

  const discovered = await discoverActivitySources();
  assert.ok(discovered.some((source) => source.id === "codebuddy"));
});
