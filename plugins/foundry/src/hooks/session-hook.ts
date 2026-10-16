#!/usr/bin/env node
import { appendFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { stdin } from "node:process";
import { readCodeBuddySession } from "../adapters/codebuddy-session.ts";
import { readCodexSession } from "../adapters/codex-session.ts";
import { captureActivity } from "../core/activities.ts";
import { hasActivityContent } from "../core/intelligence/activity-content.ts";
import { compileSessionKnowledge } from "../core/intelligence/session-compiler.ts";
import { writeSessionRecord } from "../core/sessions.ts";
import { hostDirPath } from "../core/storage.ts";

async function writeDiagnostic(entry: Record<string, unknown>): Promise<void> {
  try {
    const runtime = await hostDirPath("runtime");
    await mkdir(runtime, { recursive: true });
    await appendFile(
      path.join(runtime, "session-hook-diagnostics.jsonl"),
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`,
      "utf8",
    );
  } catch {
    // Diagnostics must never block session capture.
  }
}

async function transcriptInfo(transcriptPath: string | undefined): Promise<Record<string, unknown>> {
  if (!transcriptPath) return { transcript_path: null, transcript_exists: false };
  try {
    const info = await stat(transcriptPath);
    return {
      transcript_path: transcriptPath,
      transcript_exists: info.isFile(),
      transcript_bytes: info.size,
      transcript_mtime: info.mtime.toISOString(),
    };
  } catch (error) {
    return {
      transcript_path: transcriptPath,
      transcript_exists: false,
      transcript_error: error instanceof Error ? error.message : String(error),
    };
  }
}

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
  const source = eventSource(event);
  await writeDiagnostic({
    phase: "received",
    source,
    event_keys: Object.keys(event).sort(),
    session_id_present: Boolean(sessionId),
    ...(await transcriptInfo(transcriptPath)),
  });

  let session;
  try {
    session = await readSession(event, transcriptPath);
  } catch (error) {
    await writeDiagnostic({
      phase: "error",
      source,
      session_id_present: Boolean(sessionId),
      error: error instanceof Error ? error.message : String(error),
      ...(await transcriptInfo(transcriptPath)),
    });
    throw error;
  }
  const compiled = compileSessionKnowledge(session);
  await writeDiagnostic({
    phase: "parsed",
    source,
    session_id_present: Boolean(sessionId),
    transcript_path: transcriptPath ?? null,
    message_count: session.messages.length,
    compiled_message_count: compiled.session_record.message_count,
    compiled_task_present: Boolean(compiled.activity.task),
    compiled_result_present: Boolean(compiled.activity.result),
  });
  const project =
    stringValue(event.cwd) ??
    stringValue(event.workingDirectory) ??
    stringValue(getPath(event, ["session", "cwd"])) ??
    process.cwd();

  let storedSession: Record<string, unknown> | undefined;
  if (sessionId || compiled.session_record.message_count > 0) {
    storedSession = await writeSessionRecord(sessionId, {
      ...compiled.session_record,
      source: eventSource(event),
      project,
    });
  }
  const storedSourceRef = storedSession?.source_ref;
  const storedTranscriptPath =
    storedSourceRef && typeof storedSourceRef === "object" && !Array.isArray(storedSourceRef)
      ? stringValue((storedSourceRef as Record<string, unknown>).path)
      : undefined;
  const effectiveTranscriptPath = transcriptPath ?? storedTranscriptPath;

  const capture = {
    session_id: sessionId,
    source: eventSource(event),
    project,
    timestamp: validTimestamp(event.timestamp ?? event.time ?? event.ended_at),
    task: event.task ?? compiled.activity.task ?? null,
    result: event.result ?? compiled.activity.result ?? null,
    summary: stringValue(event.summary) || compiled.activity.summary || "SessionEnd captured",
    key_points: Array.isArray(event.key_points) ? event.key_points : compiled.activity.key_points || [],
    context: effectiveTranscriptPath || "",
    metadata: effectiveTranscriptPath
      ? { transcript_path: effectiveTranscriptPath, enrichment: compiled.activity.result ? "compiler" : "pending" }
      : undefined,
  };
  if (!hasActivityContent(capture)) {
    await writeDiagnostic({
      phase: "skipped_blank",
      source,
      session_id_present: Boolean(sessionId),
      transcript_path: effectiveTranscriptPath ?? null,
    });
    console.log("SessionEnd skipped blank Activity");
    return;
  }
  const activity = await captureActivity(capture, { requireTaskResult: false });
  await writeDiagnostic({
    phase: "captured",
    source,
    session_id_present: Boolean(sessionId),
    activity_id: activityId(activity),
  });
  console.log(`Captured activity: ${activityId(activity)}`);
}

main().catch((err: unknown) => {
  console.error("session-hook error:", err);
  process.exit(1);
});
