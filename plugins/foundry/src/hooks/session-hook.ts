#!/usr/bin/env node
import { stdin } from "node:process";
import { readCodeBuddySession } from "../adapters/codebuddy-session.ts";
import { readCodexSession } from "../adapters/codex-session.ts";
import { captureActivity } from "../core/activities.ts";
import { compileSessionKnowledge } from "../core/intelligence/session-compiler.ts";
import { writeSessionRecord } from "../core/sessions.ts";

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function validTimestamp(value: unknown): string {
  const date = new Date(typeof value === "string" || typeof value === "number" ? value : "");
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}

function hostSource(): string {
  if (process.env.CODEBUDDY_PLUGIN_ROOT || process.env.CODEBUDDY_PLUGIN_DATA) return "codebuddy";
  return "codex";
}

function getPath(event: Record<string, unknown>, keys: string[]): unknown {
  let value: unknown = event;
  for (const key of keys) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function activityId(value: unknown): string {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { id?: unknown }).id === "string"
  ) {
    return (value as { id: string }).id;
  }
  return "unknown";
}

function eventSource(event: Record<string, unknown>): string {
  return stringValue(event.source) ?? hostSource();
}

async function readSession(event: Record<string, unknown>, transcriptPath: string | undefined) {
  if (eventSource(event) === "codebuddy") return readCodeBuddySession(transcriptPath);
  const codex = readCodexSession(event);
  if (codex.messages.length) return codex;
  return readCodeBuddySession(transcriptPath);
}

async function main(): Promise<void> {
  const raw = await readStdin();
  if (!raw) return;

  let event: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("event must be an object");
    event = parsed as Record<string, unknown>;
  } catch (err) {
    console.error("Failed to parse stdin JSON:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const sessionId =
    stringValue(event.session_id) ??
    stringValue(event.sessionId) ??
    stringValue(getPath(event, ["session", "id"])) ??
    stringValue(getPath(event, ["session", "session_id"]));
  const transcriptPath =
    stringValue(event.transcript_path) ??
    stringValue(event.transcriptPath) ??
    stringValue(getPath(event, ["transcript", "path"])) ??
    stringValue(getPath(event, ["session", "transcript"]));
  const session = await readSession(event, transcriptPath);
  const compiled = compileSessionKnowledge(session);
  const project =
    stringValue(event.cwd) ??
    stringValue(event.workingDirectory) ??
    stringValue(getPath(event, ["session", "cwd"])) ??
    process.cwd();

  if (sessionId || compiled.session_record.message_count > 0) {
    await writeSessionRecord(sessionId, {
      ...compiled.session_record,
      source: eventSource(event),
      project,
    });
  }

  const activity = await captureActivity(
    {
      session_id: sessionId,
      source: eventSource(event),
      project,
      timestamp: validTimestamp(event.timestamp ?? event.time ?? event.ended_at),
      task: event.task ?? compiled.activity.task ?? null,
      result: event.result ?? compiled.activity.result ?? null,
      summary: stringValue(event.summary) || compiled.activity.summary || "SessionEnd captured",
      key_points: Array.isArray(event.key_points) ? event.key_points : compiled.activity.key_points || [],
      context: transcriptPath || "",
      metadata: transcriptPath
        ? { transcript_path: transcriptPath, enrichment: compiled.activity.result ? "compiler" : "pending" }
        : undefined,
    },
    { requireTaskResult: false },
  );

  console.log(`Captured activity: ${activityId(activity)}`);
}

main().catch((err: unknown) => {
  console.error("session-hook error:", err);
  process.exit(1);
});
