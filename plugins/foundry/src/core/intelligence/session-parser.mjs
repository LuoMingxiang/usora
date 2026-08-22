import { normalizeSessionProtocol } from "../session-protocol.mjs";

export function parseSessionEvents(session) {
  const normalized = normalizeSessionProtocol(session);
  return (normalized.messages || []).map((message, index) => ({
    id: message.id || `event-${index + 1}`,
    index,
    role: message.role,
    timestamp: message.timestamp || null,
    text: message.text || "",
  }));
}
