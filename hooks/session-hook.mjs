#!/usr/bin/env node
import { stdin } from "node:process";
import { captureActivity } from "../src/core/activities.mjs";

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

  const activity = await captureActivity(
    {
      session_id: sessionId,
      source: eventSource(event),
      project: event.cwd || event.workingDirectory || event.session?.cwd || process.cwd(),
      timestamp: validTimestamp(event.timestamp || event.time || event.ended_at),
      task: event.task ?? null,
      result: event.result ?? null,
      summary: event.summary || "SessionEnd captured",
      context: transcriptPath || "",
      metadata: transcriptPath ? { transcript_path: transcriptPath } : undefined,
    },
    { requireTaskResult: false },
  );

  console.log(`Captured activity: ${activity.id}`);
}

main().catch((err) => {
  console.error("session-hook error:", err);
  process.exit(1);
});
