export const USORA_SESSION_PROTOCOL_VERSION = 1;
export const SESSION_EVENT_TYPES = ["user", "assistant", "tool", "command", "error", "validation", "event"];

type RawSessionMessage = Record<string, unknown> & {
  role?: string;
  text?: unknown;
  content?: unknown;
  message?: unknown;
  id?: unknown;
  event_type?: unknown;
  timestamp?: unknown;
};

type RawSession = Record<string, unknown> & {
  source?: unknown;
  source_ref?: unknown;
  messages?: unknown;
};

export function compactText(value: unknown, limit = 2000): string {
  const text = String(value || "")
    .replace(/<additional_data>[\s\S]*?<\/additional_data>/g, "")
    .replace(/<\/?user_query>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

export function normalizeSessionProtocol(session: RawSession = {}) {
  const messages = [];
  const rawMessages = Array.isArray(session.messages) ? session.messages : [];
  for (const rawMessage of rawMessages) {
    const message = rawMessage && typeof rawMessage === "object" ? (rawMessage as RawSessionMessage) : {};
    const rawRole = typeof message.role === "string" ? message.role : undefined;
    const role = rawRole && SESSION_EVENT_TYPES.includes(rawRole) ? rawRole : "event";
    const text = compactText(message.text || message.content || message.message || "");
    if (!text) continue;
    messages.push({
      id: message.id ?? null,
      role,
      event_type: role === "event" ? rawRole || "unsupported" : message.event_type || role,
      timestamp: message.timestamp ?? null,
      text,
    });
  }
  return {
    schema_version: USORA_SESSION_PROTOCOL_VERSION,
    source: session.source || "unknown",
    source_ref: session.source_ref ?? null,
    messages,
  };
}

export function validateSessionProtocol(session: RawSession = {}) {
  const issues = [];
  if (session.schema_version !== USORA_SESSION_PROTOCOL_VERSION) issues.push("schema_version must be 1");
  if (!Array.isArray(session.messages)) issues.push("messages must be an array");
  const messages = Array.isArray(session.messages) ? session.messages : [];
  for (const [index, rawMessage] of messages.entries()) {
    const message = rawMessage && typeof rawMessage === "object" ? (rawMessage as RawSessionMessage) : {};
    if (!message.role || !SESSION_EVENT_TYPES.includes(String(message.role))) {
      issues.push(`messages[${index}].role is unsupported`);
    }
    if (typeof message.text !== "string" || !message.text) {
      issues.push(`messages[${index}].text is required`);
    }
  }
  return { ok: issues.length === 0, issues };
}
