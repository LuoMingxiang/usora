export const USORA_SESSION_PROTOCOL_VERSION = 1;
export const SESSION_EVENT_TYPES = ["user", "assistant", "tool", "command", "error", "validation", "event"];

export function compactText(value, limit = 2000) {
  const text = String(value || "")
    .replace(/<additional_data>[\s\S]*?<\/additional_data>/g, "")
    .replace(/<\/?user_query>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

export function normalizeSessionProtocol(session = {}) {
  const messages = [];
  for (const message of session.messages || []) {
    const role = SESSION_EVENT_TYPES.includes(message?.role) ? message.role : "event";
    const text = compactText(message?.text || message?.content || message?.message || "");
    if (!text) continue;
    messages.push({
      id: message.id || null,
      role,
      event_type: role === "event" ? message?.role || "unsupported" : message?.event_type || role,
      timestamp: message.timestamp || null,
      text,
    });
  }
  return {
    schema_version: USORA_SESSION_PROTOCOL_VERSION,
    source: session.source || "unknown",
    source_ref: session.source_ref || null,
    messages,
  };
}

export function validateSessionProtocol(session = {}) {
  const issues = [];
  if (session.schema_version !== USORA_SESSION_PROTOCOL_VERSION) issues.push("schema_version must be 1");
  if (!Array.isArray(session.messages)) issues.push("messages must be an array");
  for (const [index, message] of (session.messages || []).entries()) {
    if (!SESSION_EVENT_TYPES.includes(message.role)) issues.push(`messages[${index}].role is unsupported`);
    if (typeof message.text !== "string" || !message.text) issues.push(`messages[${index}].text is required`);
  }
  return { ok: issues.length === 0, issues };
}
