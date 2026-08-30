import { compactText, normalizeSessionProtocol } from "../core/session-protocol.ts";

type RawCodexMessage = Record<string, unknown> & {
  role?: string;
  text?: unknown;
  content?: unknown;
  message?: unknown;
  id?: unknown;
  timestamp?: unknown;
};

type RawCodexEvent = Record<string, unknown> & {
  messages?: unknown;
  session?: { messages?: unknown };
};

export function readCodexSession(event: RawCodexEvent) {
  const messages = [];
  const rawMessages = Array.isArray(event.messages)
    ? event.messages
    : Array.isArray(event.session?.messages)
      ? event.session.messages
      : [];
  for (const rawMessage of rawMessages) {
    const message = rawMessage && typeof rawMessage === "object" ? (rawMessage as RawCodexMessage) : {};
    if (!message.role || !["user", "assistant", "tool", "command", "error", "validation"].includes(message.role)) {
      continue;
    }
    const text = compactText(message.text || message.content || message.message || "");
    if (text) messages.push({ id: message.id ?? null, role: message.role, timestamp: message.timestamp ?? null, text });
  }
  return normalizeSessionProtocol({ source: "codex", messages });
}
