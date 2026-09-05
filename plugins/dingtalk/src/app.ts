import type { IntegrationCommandResult } from "@usora/integration";

type FetchResponse = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<FetchResponse>;

export type DingTalkAppClientOptions = {
  appKey: string;
  appSecret: string;
  baseUrl?: string;
  fetch?: FetchLike;
  now?: () => number;
};

export type DingTalkAccessToken = {
  accessToken: string;
  expiresAt: number;
};

export type DingTalkAppClient = {
  getAccessToken(force?: boolean): Promise<IntegrationCommandResult<DingTalkAccessToken>>;
  request(pathname: string, init?: { method?: string; body?: unknown }): Promise<IntegrationCommandResult<unknown>>;
};

async function readBody(response: FetchResponse): Promise<unknown> {
  if (response.json) return response.json();
  if (response.text) return response.text();
  return null;
}

function bodyError(body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const code = (body as { code?: unknown; errcode?: unknown }).code ?? (body as { errcode?: unknown }).errcode;
  if ((body as { success?: boolean }).success === false) return "DingTalk operation failed";
  if (code === undefined || code === "0" || code === 0) return null;
  const message = (body as { message?: unknown; errmsg?: unknown }).message ?? (body as { errmsg?: unknown }).errmsg;
  return typeof message === "string" ? message : `DingTalk app API error: ${String(code)}`;
}

function tokenFromBody(body: unknown, now: number): DingTalkAccessToken | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const accessToken = (body as { accessToken?: unknown }).accessToken;
  const expireIn = (body as { expireIn?: unknown }).expireIn;
  if (typeof accessToken !== "string" || typeof expireIn !== "number") return null;
  return { accessToken, expiresAt: now + expireIn * 1000 };
}

export function createDingTalkAppClient(options: DingTalkAppClientOptions): DingTalkAppClient {
  const fetcher = options.fetch ?? fetch;
  const baseUrl = options.baseUrl ?? "https://api.dingtalk.com";
  const now = options.now ?? Date.now;
  let cached: DingTalkAccessToken | null = null;

  async function getAccessToken(force = false): Promise<IntegrationCommandResult<DingTalkAccessToken>> {
    if (!force && cached && cached.expiresAt - now() > 60_000) return { ok: true, data: cached };
    const response = await fetcher(`${baseUrl}/v1.0/oauth2/accessToken`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appKey: options.appKey, appSecret: options.appSecret }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await readBody(response);
    const error = bodyError(body);
    if (!response.ok) return { ok: false, error: `DingTalk app HTTP ${response.status}`, code: "DINGTALK_HTTP" };
    if (error) return { ok: false, error, code: "DINGTALK_API" };
    const token = tokenFromBody(body, now());
    if (!token) return { ok: false, error: "DingTalk access token response is invalid", code: "DINGTALK_TOKEN" };
    cached = token;
    return { ok: true, data: token };
  }

  return {
    getAccessToken,
    async request(pathname, init = {}) {
      if (!pathname.startsWith("/v1.0/")) throw Error("Invalid DingTalk API path");
      const token = await getAccessToken();
      if (!token.ok) return token;
      const response = await fetcher(`${baseUrl}${pathname}`, {
        method: init.method ?? "POST",
        headers: {
          "content-type": "application/json",
          "x-acs-dingtalk-access-token": token.data.accessToken,
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        signal: AbortSignal.timeout(10_000),
      });
      const body = await readBody(response);
      const error = bodyError(body);
      if (!response.ok) return { ok: false, error: `DingTalk app HTTP ${response.status}`, code: "DINGTALK_HTTP" };
      if (error) return { ok: false, error, code: "DINGTALK_API" };
      return { ok: true, data: body };
    },
  };
}
