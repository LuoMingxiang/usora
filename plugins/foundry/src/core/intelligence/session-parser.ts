import { normalizeSessionProtocol } from "../session-protocol.ts";

export type ParsedSessionEvent = {
  id: unknown;
  index: number;
  role: string;
  timestamp: unknown;
  text: string;
};

export function parseSessionEvents(session: Parameters<typeof normalizeSessionProtocol>[0]): ParsedSessionEvent[] {
  const normalized = normalizeSessionProtocol(session);
  return (normalized.messages || []).map((message, index) => ({
    id: message.id || `event-${index + 1}`,
    index,
    role: message.role,
    timestamp: message.timestamp || null,
    text: message.text || "",
  }));
}
