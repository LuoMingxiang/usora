import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { readCodeBuddySession } from "../../plugins/foundry/src/adapters/codebuddy-session.mjs";
import { readCodexSession } from "../../plugins/foundry/src/adapters/codex-session.mjs";
import { normalizeSessionProtocol, validateSessionProtocol } from "../../plugins/foundry/src/core/session-protocol.mjs";
import { compileSessionKnowledge } from "../../plugins/foundry/src/core/intelligence/session-compiler.mjs";

test("Session Protocol v1 validates required fields and gracefully normalizes unsupported events", () => {
  const normalized = normalizeSessionProtocol({
    source: "future-host",
    messages: [{ id: "x1", role: "custom-event", text: "unsupported but useful" }],
  });

  assert.equal(normalized.schema_version, 1);
  assert.equal(normalized.messages[0].role, "event");
  assert.equal(normalized.messages[0].event_type, "custom-event");
  assert.deepEqual(validateSessionProtocol(normalized), { ok: true, issues: [] });
  assert.equal(validateSessionProtocol({ schema_version: 1, messages: [{ role: "user" }] }).ok, false);
});

test("Codex and CodeBuddy adapters emit Session Protocol v1", async (t) => {
  const codex = readCodexSession({
    messages: [
      { id: "u1", role: "user", text: "build it" },
      { id: "a1", role: "assistant", text: "done" },
    ],
  });
  assert.equal(validateSessionProtocol(codex).ok, true);
  assert.equal(codex.source, "codex");

  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-protocol-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const transcriptDir = path.join(cwd, "session");
  const messagesDir = path.join(transcriptDir, "messages");
  await mkdir(messagesDir, { recursive: true });
  await writeFile(path.join(transcriptDir, "index.json"), JSON.stringify({ messages: [{ id: "u1", role: "user" }] }));
  await writeFile(
    path.join(messagesDir, "u1.json"),
    JSON.stringify({ role: "user", extra: JSON.stringify({ sourceContentBlocks: [{ text: "hello" }] }) }),
  );

  const codebuddy = await readCodeBuddySession(path.join(transcriptDir, "index.json"));
  assert.equal(validateSessionProtocol(codebuddy).ok, true);
  assert.equal(codebuddy.source, "codebuddy");
  assert.equal(codebuddy.source_ref.path, path.join(transcriptDir, "index.json"));
});

test("core intelligence consumes protocol data without host transcript internals", async () => {
  const compiled = compileSessionKnowledge(
    normalizeSessionProtocol({
      source: "future-host",
      messages: [
        { role: "user", text: "must keep this constraint" },
        { role: "assistant", text: "verified" },
      ],
    }),
  );
  assert.equal(compiled.session_record.message_count, 2);
  assert.ok(compiled.activity.key_points.some((point) => point.includes("must keep")));

  const coreFiles = [
    "plugins/foundry/src/core/intelligence/knowledge-extractor.mjs",
    "plugins/foundry/src/core/intelligence/session-parser.mjs",
    "plugins/foundry/src/core/intelligence/session-compiler.mjs",
  ];
  for (const file of coreFiles) {
    const text = await readFile(path.resolve(file), "utf8");
    assert.doesNotMatch(text, /CodeBuddy|Codex|sourceContentBlocks|transcript_path|codebuddy-session/);
  }
});
