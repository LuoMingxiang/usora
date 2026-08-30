import fs from "node:fs/promises";
import path from "node:path";
import { compactText, normalizeSessionProtocol } from "../core/session-protocol.ts";

type CodeBuddyIndex = {
  messages?: unknown;
};

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
};

function parseJson(value: unknown): unknown {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => (block && typeof block === "object" ? (block as CodeBuddyContentBlock).text : ""))
    .filter((text): text is string => typeof text === "string" && Boolean(text))
    .join("\n");
}

async function readMessage(file: string, fallback: CodeBuddyIndexEntry = {}) {
  const item = parseJson(await fs.readFile(file, "utf8")) as CodeBuddyStoredMessage | null;
  const extra = parseJson(item?.extra) as { sourceContentBlocks?: unknown } | null;
  const message = parseJson(item?.message) as { content?: unknown } | null;
  return {
    id: fallback.id,
    role: item?.role || fallback.role,
    timestamp: item?.timestamp || item?.created_at || fallback.timestamp || null,
    text: compactText(textFromContent(extra?.sourceContentBlocks) || textFromContent(message?.content)),
  };
}

export async function readCodeBuddySession(transcriptPath: string | undefined) {
  if (!transcriptPath) return normalizeSessionProtocol({ source: "codebuddy", messages: [] });
  const index = parseJson(await fs.readFile(transcriptPath, "utf8").catch(() => "")) as CodeBuddyIndex | null;
  const messages = [];
  const indexMessages = Array.isArray(index?.messages) ? index.messages : [];
  for (const rawEntry of indexMessages) {
    const entry = rawEntry && typeof rawEntry === "object" ? (rawEntry as CodeBuddyIndexEntry) : {};
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    const file = path.join(path.dirname(transcriptPath), "messages", `${entry.id}.json`);
    const message = await readMessage(file, entry).catch(() => null);
    if (message?.text) messages.push(message);
  }
  return normalizeSessionProtocol({
    source: "codebuddy",
    source_ref: { type: "host_transcript", path: transcriptPath },
    messages,
  });
}
