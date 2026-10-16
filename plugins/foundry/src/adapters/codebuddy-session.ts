import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { compactText, normalizeSessionProtocol } from "../core/session-protocol.ts";

type CodeBuddyIndexEntry = {
  id?: unknown;
  role?: unknown;
  timestamp?: unknown;
};

type CodeBuddyStoredMessage = {
  role?: unknown;
  timestamp?: unknown;
  created_at?: unknown;
  extra?: unknown;
  message?: unknown;
};

type CodeBuddyContentBlock = {
  text?: unknown;
  content?: unknown;
};

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const item = block as CodeBuddyContentBlock;
      return textFromContent(item.text) || textFromContent(item.content);
    })
    .filter(Boolean)
    .join("\n");
}

async function readLegacyMessage(file: string, fallback: CodeBuddyIndexEntry = {}) {
  const item = parseJson(await fs.readFile(file, "utf8")) as CodeBuddyStoredMessage | null;
  const extra = parseJson(typeof item?.extra === "string" ? item.extra : "") as {
    sourceContentBlocks?: unknown;
  } | null;
  const message = parseJson(typeof item?.message === "string" ? item.message : "") as { content?: unknown } | null;
  return {
    id: fallback.id,
    role: item?.role || fallback.role,
    timestamp: item?.timestamp || item?.created_at || fallback.timestamp || null,
    text: compactText(textFromContent(extra?.sourceContentBlocks) || textFromContent(message?.content)),
  };
}

async function readLegacyIndex(index: Record<string, unknown>, transcriptPath: string) {
  const messages = [];
  const indexMessages = Array.isArray(index.messages) ? index.messages : [];
  for (const rawEntry of indexMessages) {
    const entry = rawEntry && typeof rawEntry === "object" ? (rawEntry as CodeBuddyIndexEntry) : {};
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    const file = path.join(path.dirname(transcriptPath), "messages", entry.id + ".json");
    const message = await readLegacyMessage(file, entry).catch(() => null);
    if (message?.text) messages.push(message);
  }
  return messages;
}

function messageFromRecord(record: Record<string, unknown>) {
  const message = isRecord(record.message) ? record.message : record;
  const role =
    typeof message.role === "string"
      ? message.role
      : typeof record.type === "string" &&
          ["user", "assistant", "tool", "command", "error", "validation"].includes(record.type)
        ? record.type
        : undefined;
  if (!role) return null;

  const content =
    message.content ??
    message.text ??
    (typeof message.message === "string" ? message.message : undefined) ??
    record.content ??
    record.text;
  const text = compactText(textFromContent(content));
  return text
    ? { id: message.id ?? record.id ?? null, role, timestamp: message.timestamp ?? record.timestamp ?? null, text }
    : null;
}

export async function readCodeBuddySession(transcriptPath: string | undefined) {
  if (!transcriptPath) return normalizeSessionProtocol({ source: "codebuddy", messages: [] });

  const messages = [];
  const input = createInterface({ input: createReadStream(transcriptPath), crlfDelay: Infinity });
  let firstRecord = true;
  try {
    for await (const line of input) {
      if (!line.trim()) continue;
      const record = parseJson(line);
      if (!isRecord(record)) continue;
      if (firstRecord && Array.isArray(record.messages)) {
        messages.push(...(await readLegacyIndex(record, transcriptPath)));
        break;
      }
      firstRecord = false;
      const message = messageFromRecord(record);
      if (message) messages.push(message);
    }
  } catch {
    // A missing or partially written transcript should not prevent SessionEnd from completing.
  }
  return normalizeSessionProtocol({
    source: "codebuddy",
    source_ref: { type: "host_transcript", path: transcriptPath },
    messages,
  });
}
