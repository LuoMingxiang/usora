import { compactText } from "./codebuddy-session.mjs";

export function readCodexSession(event) {
  const messages = [];
  for (const message of event.messages || event.session?.messages || []) {
    if (!["user", "assistant", "tool", "command", "error", "validation"].includes(message?.role)) continue;
    const text = compactText(message.text || message.content || message.message || "");
    if (text) messages.push({ id: message.id || null, role: message.role, timestamp: message.timestamp || null, text });
  }
  return { messages };
}
