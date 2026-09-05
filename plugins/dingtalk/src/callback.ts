import { createHmac, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type DingTalkCallback = {
  id: string;
  actionId: string;
  userId: string;
  corpId?: string;
  payload: Record<string, unknown>;
};

export type DingTalkCallbackInput = {
  headers?: Record<string, string | undefined>;
  body: string;
  secret?: string;
  now?: number;
};

export type DingTalkCallbackResult =
  | { ok: true; callback: DingTalkCallback }
  | { ok: false; status: 400 | 401; error: string };

export type DingTalkCallbackReceipt = {
  id: string;
  actionId: string;
  userId: string;
  receivedAt: string;
};

export type DingTalkCallbackClaimResult =
  | { ok: true; receipt: DingTalkCallbackReceipt }
  | { ok: false; status: 409; error: string };

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return found?.[1];
}

function stringField(record: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function sameSignature(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Local signed envelopes only. Real DingTalk callbacks enter through the authenticated Stream connection.
export function signDingTalkCallback(timestamp: number, body: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}\n${body}`).digest("base64");
}

function verify(headers: Record<string, string | undefined>, secret: string, body: string, now: number): boolean {
  const timestamp = Number(header(headers, "x-dingtalk-timestamp"));
  const signature = header(headers, "x-dingtalk-signature");
  if (!Number.isSafeInteger(timestamp) || !signature || Math.abs(now - timestamp) > 300_000) return false;
  return sameSignature(signature, signDingTalkCallback(timestamp, body, secret));
}

export function parseDingTalkCallback(input: DingTalkCallbackInput): DingTalkCallbackResult {
  const headers = input.headers || {};
  if (!input.secret || !verify(headers, input.secret, input.body, input.now ?? Date.now()))
    return { ok: false, status: 401, error: "invalid signature" };
  return parseCallbackBody(input.body);
}

function parseCallbackBody(body: string): DingTalkCallbackResult {
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("callback body must be an object");
    payload = parsed as Record<string, unknown>;
  } catch {
    return { ok: false, status: 400, error: "malformed callback body" };
  }

  const id = stringField(payload, "callbackId", "callback_id", "eventId", "event_id");
  const actionId = stringField(payload, "actionId", "action_id");
  const userId = stringField(payload, "userId", "user_id", "senderStaffId");
  const corpId = stringField(payload, "corpId", "corp_id", "conversationCorpId");
  if (!id || !actionId || !userId)
    return { ok: false, status: 400, error: "callback id, action id, and user id are required" };

  return {
    ok: true,
    callback: {
      id,
      actionId,
      userId,
      ...(corpId ? { corpId } : {}),
      payload,
    },
  };
}

export function parseDingTalkStreamCallback(messageId: string, body: string): DingTalkCallbackResult {
  try {
    const message = JSON.parse(body);
    const actionIds = JSON.parse(message.content).cardPrivateData.actionIds;
    if (!Array.isArray(actionIds) || actionIds.length !== 1) throw Error("one action is required");
    return parseCallbackBody(
      JSON.stringify({
        callbackId: messageId,
        actionId: actionIds[0],
        userId: message.userId,
        corpId: message.corpId,
        outTrackId: message.outTrackId,
      }),
    );
  } catch {
    return { ok: false, status: 400, error: "malformed Stream card callback" };
  }
}

export function dingTalkCallbackReceiptFile(root: string, callbackId: string): string {
  return path.join(root, "callbacks", `${encodeURIComponent(callbackId)}.json`);
}

export async function readDingTalkCallbackReceipt(file: string): Promise<DingTalkCallbackReceipt | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as DingTalkCallbackReceipt;
  } catch {
    return null;
  }
}

export async function claimDingTalkCallback(
  root: string,
  callback: DingTalkCallback,
  now = new Date().toISOString(),
): Promise<DingTalkCallbackClaimResult> {
  const receipt = { id: callback.id, actionId: callback.actionId, userId: callback.userId, receivedAt: now };
  const file = dingTalkCallbackReceiptFile(root, callback.id);
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    await fs.writeFile(file, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return { ok: true, receipt };
  } catch (error) {
    if (error && typeof error === "object" && (error as { code?: unknown }).code === "EEXIST") {
      return { ok: false, status: 409, error: "duplicate callback" };
    }
    throw error;
  }
}
