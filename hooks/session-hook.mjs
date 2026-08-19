#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
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

function parseJson(value) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function textFromContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => block?.text || "")
    .filter(Boolean)
    .join("\n");
}

function compactText(value, limit = 2000) {
  const text = String(value || "")
    .replace(/<additional_data>[\s\S]*?<\/additional_data>/g, "")
    .replace(/<\/?user_query>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function readMessage(file) {
  const item = parseJson(await fs.readFile(file, "utf8"));
  const extra = parseJson(item?.extra);
  const message = parseJson(item?.message);
  return {
    role: item?.role,
    text: compactText(textFromContent(extra?.sourceContentBlocks) || textFromContent(message?.content)),
  };
}

async function extractTranscript(transcriptPath) {
  if (!transcriptPath) return {};
  const index = parseJson(await fs.readFile(transcriptPath, "utf8").catch(() => ""));
  const messages = [];
  for (const entry of index?.messages || []) {
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    const message = await readMessage(path.join(path.dirname(transcriptPath), "messages", `${entry.id}.json`)).catch(
      () => null,
    );
    if (message?.text) messages.push(message);
  }

  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.text);
  const assistantMessages = messages.filter((message) => message.role === "assistant").map((message) => message.text);

  // ponytail: heuristic extraction; replace with host-provided AI summary when CodeBuddy exposes one.
  const task = userMessages[0];
  const result = assistantMessages.at(-1);
  const keyPoints = unique(userMessages.slice(-5).map((message) => compactText(message, 240)));
  return { task, result, keyPoints, summary: result ? compactText(result, 200) : undefined };
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
  const transcript = await extractTranscript(transcriptPath);

  const activity = await captureActivity(
    {
      session_id: sessionId,
      source: eventSource(event),
      project: event.cwd || event.workingDirectory || event.session?.cwd || process.cwd(),
      timestamp: validTimestamp(event.timestamp || event.time || event.ended_at),
      task: event.task ?? transcript.task ?? null,
      result: event.result ?? transcript.result ?? null,
      summary: event.summary || transcript.summary || "SessionEnd captured",
      key_points: event.key_points || transcript.keyPoints || [],
      context: transcriptPath || "",
      metadata: transcriptPath
        ? { transcript_path: transcriptPath, enrichment: transcript.result ? "heuristic" : "pending" }
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
