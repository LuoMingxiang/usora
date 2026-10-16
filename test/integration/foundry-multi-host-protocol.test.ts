import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { readCodeBuddySession } from "../../plugins/foundry/src/adapters/codebuddy-session.ts";
import { readCodexSession } from "../../plugins/foundry/src/adapters/codex-session.ts";
import { normalizeSessionProtocol, validateSessionProtocol } from "../../plugins/foundry/src/core/session-protocol.ts";
import { compileSessionKnowledge } from "../../plugins/foundry/src/core/intelligence/session-compiler.ts";

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

test("CodeBuddy adapter reads newline-delimited transcripts", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-codebuddy-jsonl-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const transcript = path.join(cwd, "session.jsonl");
  await writeFile(
    transcript,
    [
      JSON.stringify({ type: "init", session_id: "s1" }),
      JSON.stringify({ type: "user", message: { role: "user", content: "Fix the parser" } }),
      JSON.stringify({
        type: "assistant",
        message: { role: "assistant", content: [{ type: "text", text: "Parser fixed" }] },
      }),
      "not-json",
      JSON.stringify({ type: "result", subtype: "success" }),
    ].join("\n"),
  );

  const session = await readCodeBuddySession(transcript);
  assert.equal(validateSessionProtocol(session).ok, true);
  assert.equal(session.source_ref.path, transcript);
  assert.deepEqual(
    session.messages.map(({ role, text }) => ({ role, text })),
    [
      { role: "user", text: "Fix the parser" },
      { role: "assistant", text: "Parser fixed" },
    ],
  );
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
    "plugins/foundry/src/core/intelligence/knowledge-extractor.ts",
    "plugins/foundry/src/core/intelligence/session-parser.ts",
    "plugins/foundry/src/core/intelligence/session-compiler.ts",
  ];
  for (const file of coreFiles) {
    const text = await readFile(path.resolve(file), "utf8");
    assert.doesNotMatch(text, /CodeBuddy|Codex|sourceContentBlocks|transcript_path|codebuddy-session/);
  }
});
