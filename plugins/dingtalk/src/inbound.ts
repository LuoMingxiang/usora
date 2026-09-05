import type { ExternalIdentity } from "@usora/integration";
import { dingTalkExternalIdentity } from "./identity.ts";

export type DingTalkInboundMessage = {
  id: string;
  actor: ExternalIdentity;
  conversation: {
    id: string;
    title?: string;
    corpId?: string;
  };
  text: string;
  payload: Record<string, unknown>;
};

function stringField(record: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function messageText(payload: Record<string, unknown>): string | undefined {
  const text = payload.text;
  if (typeof text === "string") return text;
  if (text && typeof text === "object" && !Array.isArray(text))
    return stringField(text as Record<string, unknown>, "content");
  return stringField(payload, "content");
}

export function parseDingTalkInboundMessage(payload: Record<string, unknown>): DingTalkInboundMessage {
  const id = stringField(payload, "msgId", "messageId", "msg_id");
  const userId = stringField(payload, "senderStaffId", "senderId", "userId", "user_id");
  const corpId = stringField(payload, "conversationCorpId", "corpId", "corp_id");
  const conversationId = stringField(payload, "conversationId", "conversation_id");
  const text = messageText(payload);
  const displayName = stringField(payload, "senderNick", "senderName");
  const conversationTitle = stringField(payload, "conversationTitle");
  if (!id || !userId || !conversationId || !text)
    throw Error("message id, user id, conversation id, and text are required");
  return {
    id,
    actor: dingTalkExternalIdentity({
      userId,
      ...(corpId ? { corpId } : {}),
      ...(displayName ? { displayName } : {}),
    }),
    conversation: {
      id: conversationId,
      ...(conversationTitle ? { title: conversationTitle } : {}),
      ...(corpId ? { corpId } : {}),
    },
    text,
    payload,
  };
}
