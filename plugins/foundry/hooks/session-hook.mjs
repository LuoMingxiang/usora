#!/usr/bin/env node
import { stdin } from "node:process";
import { readCodeBuddySession } from "../src/adapters/codebuddy-session.mjs";
import { readCodexSession } from "../src/adapters/codex-session.mjs";
import { captureActivity } from "../src/core/activities.mjs";
import { compileSessionKnowledge } from "../src/core/intelligence/session-compiler.mjs";
import { writeSessionRecord } from "../src/core/sessions.mjs";

async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function validTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}

function hostSource() {
  if (process.env.CODEBUDDY_PLUGIN_ROOT || process.env.CODEBUDDY_PLUGIN_DATA) return "codebuddy";
  return "codex";
}

function eventSource(event) {
  return typeof event.source === "string" ? event.source : hostSource();
}

async function readSession(event, transcriptPath) {
  if (eventSource(event) === "codebuddy") return readCodeBuddySession(transcriptPath);
  const codex = readCodexSession(event);
  if (codex.messages.length) return codex;
  return readCodeBuddySession(transcriptPath);
}

async function main() {
  const raw = await readStdin();
  if (!raw) return;

  let event;
  try {
    event = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse stdin JSON:", err.message);
    process.exit(1);
  }

  const sessionId = event.session_id || event.sessionId || event.session?.id || event.session?.session_id;
  const transcriptPath =
    event.transcript_path || event.transcriptPath || event.transcript?.path || event.session?.transcript;
  const session = await readSession(event, transcriptPath);
  const compiled = compileSessionKnowledge(session);
  if (sessionId || compiled.session_record.message_count > 0) {
    await writeSessionRecord(sessionId, {
      ...compiled.session_record,
      source: eventSource(event),
      project: event.cwd || event.workingDirectory || event.session?.cwd || process.cwd(),
    });
  }

  const activity = await captureActivity(
    {
      session_id: sessionId,
      source: eventSource(event),
      project: event.cwd || event.workingDirectory || event.session?.cwd || process.cwd(),
      timestamp: validTimestamp(event.timestamp || event.time || event.ended_at),
      task: event.task ?? compiled.activity.task ?? null,
      result: event.result ?? compiled.activity.result ?? null,
      summary: event.summary || compiled.activity.summary || "SessionEnd captured",
      key_points: event.key_points || compiled.activity.key_points || [],
      context: transcriptPath || "",
      metadata: transcriptPath
        ? { transcript_path: transcriptPath, enrichment: compiled.activity.result ? "compiler" : "pending" }
        : undefined,
    },
    { requireTaskResult: false },
  );

  console.log(`Captured activity: ${activity.id}`);
}

main().catch((err) => {
  console.error("session-hook error:", err);
  process.exit(1);
});
