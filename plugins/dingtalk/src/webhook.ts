import { createHmac } from "node:crypto";
import type { MessagingCapability } from "@usora/integration";
import { renderDingTalkWebhookMessage } from "./renderer.ts";

type FetchResponse = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<FetchResponse>;

export type DingTalkWebhookOptions = {
  url: string;
  secret?: string;
  timeoutMs?: number;
  fetch?: FetchLike;
  now?: () => number;
};

export function signDingTalkWebhook(timestamp: number, secret: string): string {
  return encodeURIComponent(createHmac("sha256", secret).update(`${timestamp}\n${secret}`).digest("base64"));
}

export function dingTalkWebhookUrl(url: string, timestamp: number, secret?: string): string {
  if (!secret) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}timestamp=${timestamp}&sign=${signDingTalkWebhook(timestamp, secret)}`;
}

async function readBody(response: FetchResponse): Promise<unknown> {
  if (response.json) return response.json();
  if (response.text) return response.text();
  return null;
}

function dingTalkError(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const errcode = (body as { errcode?: unknown }).errcode;
  if (errcode === 0) return null;
  const errmsg = (body as { errmsg?: unknown }).errmsg;
  return typeof errmsg === "string" ? errmsg : `DingTalk webhook error: ${String(errcode)}`;
}

export function createDingTalkWebhookTransport(options: DingTalkWebhookOptions): MessagingCapability {
  const fetcher = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    async sendMessage(message) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const timestamp = options.now?.() ?? Date.now();
        const response = await fetcher(dingTalkWebhookUrl(options.url, timestamp, options.secret), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(renderDingTalkWebhookMessage(message)),
          signal: controller.signal,
        });
        const body = await readBody(response);
        const error = dingTalkError(body);
        if (!response.ok)
          return { ok: false, error: `DingTalk webhook HTTP ${response.status}`, code: "DINGTALK_HTTP" };
        if (error) return { ok: false, error, code: "DINGTALK_API" };
        return { ok: true, data: body };
      } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError";
        return {
          ok: false,
          error: aborted ? "DingTalk webhook timeout" : error instanceof Error ? error.message : String(error),
          code: aborted ? "DINGTALK_TIMEOUT" : "DINGTALK_ERROR",
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
