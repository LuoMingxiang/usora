import fs from "node:fs/promises";
import path from "node:path";
import { compactText, normalizeSessionProtocol } from "../core/session-protocol.mjs";

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

async function readMessage(file, fallback = {}) {
  const item = parseJson(await fs.readFile(file, "utf8"));
  const extra = parseJson(item?.extra);
  const message = parseJson(item?.message);
  return {
    id: fallback.id,
    role: item?.role || fallback.role,
    timestamp: item?.timestamp || item?.created_at || fallback.timestamp || null,
    text: compactText(textFromContent(extra?.sourceContentBlocks) || textFromContent(message?.content)),
  };
}

export async function readCodeBuddySession(transcriptPath) {
  if (!transcriptPath) return normalizeSessionProtocol({ source: "codebuddy", messages: [] });
  const index = parseJson(await fs.readFile(transcriptPath, "utf8").catch(() => ""));
  const messages = [];
  for (const entry of index?.messages || []) {
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
