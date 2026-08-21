export function parseSessionEvents(session) {
  return (session.messages || []).map((message, index) => ({
    id: message.id || `event-${index + 1}`,
    index,
    role: message.role,
    timestamp: message.timestamp || null,
    text: message.text || "",
  }));
}
