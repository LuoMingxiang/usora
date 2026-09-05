import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import {
  createCommandRegistry,
  createDeliveryRecord,
  createMessageBuilderRegistry,
  createUsoraEvent,
  readDeliveryRecord,
  runIntegrationRuntime,
  updateDeliveryRecord,
} from "../../packages/integration/src/index.ts";
import {
  DINGTALK_PROVIDER_ID,
  assertDingTalkStartup,
  automaticCaptureDingTalkResources,
  claimDingTalkCallback,
  createCandidateCreatedMessage,
  createDingTalkActionCommand,
  createDingTalkAuthorizer,
  createDingTalkBotResponse,
  createDingTalkAppClient,
  createDingTalkWebhookTransport,
  createDingTalkProvider,
  createDingTalkProviderRegistry,
  createDingTalkIdentityResolver,
  doctorDingTalkIntegration,
  createFoundryDigestMessage,
  createGovernanceMessage,
  createSkillPublishedMessage,
  dingTalkWebhookUrl,
  dingTalkCallbackReceiptFile,
  dispatchDingTalkCallback,
  dingTalkExternalIdentity,
  dingTalkIdentityFromCallback,
  createDingTalkResourceProvenance,
  createDingTalkSourceCapability,
  discoverDingTalkResources,
  parseDingTalkCallback,
  parseDingTalkBotCommand,
  parseDingTalkInboundMessage,
  redactDingTalkConfig,
  readDingTalkCallbackReceipt,
  readDingTalkResource,
  normalizeDingTalkResourceActivity,
  renderDingTalkCard,
  renderDingTalkMarkdown,
  renderDingTalkText,
  renderDingTalkWebhookMessage,
  mapDingTalkResource,
  manualCaptureDingTalkResource,
  resolveDingTalkConfig,
  signDingTalkWebhook,
} from "../../plugins/dingtalk/src/index.ts";

const foundryMcpScript = path.resolve("plugins/foundry/dist/mcp.js");
const foundryInitialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "dingtalk-test", version: "1" } },
};

async function runFoundryMcp(cwd: string, requests: Record<string, unknown>[]) {
  const child = spawn(process.execPath, [foundryMcpScript], {
    cwd,
    env: { ...process.env, HOME: cwd, USERPROFILE: cwd },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const output = await new Promise<string>((resolve, reject) => {
    let text = "";
    child.stdout.on("data", (chunk) => {
      text += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(text) : reject(Error(`server exited ${code}`))));
    child.stdin.end(requests.map(JSON.stringify).join("\n") + "\n");
  });
  return output.trim().split("\n").map(JSON.parse);
}

function foundryCall(id: number, name: string, args: Record<string, unknown> = {}) {
  return { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } };
}

function foundryBody(response: Record<string, any>) {
  return JSON.parse(response.result.content[0].text);
}

test("dingtalk provider exposes messaging capability through registry", () => {
  const provider = createDingTalkProvider({
    sendMessage: () => ({ ok: true, data: { delivered: true } }),
  });
  const registry = createDingTalkProviderRegistry(provider);

  assert.equal(provider.id, DINGTALK_PROVIDER_ID);
  assert.equal(provider.capabilities.messaging, true);
  assert.equal(registry.require("dingtalk"), provider);
  assert.deepEqual(
    registry.list("messaging").map((entry) => entry.id),
    ["dingtalk"],
  );
});

test("dingtalk startup validation rejects wrong or incomplete providers", () => {
  assert.throws(
    () =>
      assertDingTalkStartup({
        id: "other",
        capabilities: { messaging: true },
        messaging: { sendMessage: () => ({ ok: true, data: {} }) },
      }),
    /provider id/,
  );
  assert.throws(
    () =>
      assertDingTalkStartup({
        id: "dingtalk",
        capabilities: { messaging: false },
      }),
    /requires messaging/,
  );
});

test("dingtalk config resolves env secrets without leaking them", () => {
  const disabled = resolveDingTalkConfig();
  const webhook = resolveDingTalkConfig(
    {
      enabled: true,
      transport: "webhook",
      subscriptions: [
        { id: "candidate-created", event: "candidate.created", provider: "dingtalk", message: "candidate" },
      ],
    },
    { DINGTALK_WEBHOOK_URL: "https://example.test/webhook", DINGTALK_WEBHOOK_SECRET: "secret" },
  );

  assert.equal(disabled.enabled, false);
  assert.equal(disabled.transport, "webhook");
  assert.equal(webhook.capabilities.messaging, true);
  assert.equal(webhook.subscriptions[0]?.id, "candidate-created");
  assert.equal(webhook.secrets.webhookUrl, "https://example.test/webhook");
  assert.equal(redactDingTalkConfig(webhook).secrets.webhookUrl, "[REDACTED]");
  assert.throws(() => resolveDingTalkConfig({ enabled: true }, {}), /DINGTALK_WEBHOOK_URL/);
  assert.throws(() => resolveDingTalkConfig({ enabled: true, transport: "app" }, {}), /DINGTALK_APP_KEY/);
});

test("dingtalk doctor reports provider config auth delivery checkpoint retry and dead letters", () => {
  const config = resolveDingTalkConfig(
    { enabled: true },
    { DINGTALK_WEBHOOK_URL: "https://example.test/webhook", DINGTALK_WEBHOOK_SECRET: "secret" },
  );
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    occurredAt: "2026-09-05T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: {},
  });
  const base = createDeliveryRecord({ provider: "dingtalk", subscription: "candidate", event });
  const delivered = updateDeliveryRecord(base, "delivered", {}, "2026-09-05T00:01:00.000Z");
  const failed = updateDeliveryRecord(base, "failed", { error: "timeout" }, "2026-09-05T00:02:00.000Z");
  const deadLetter = updateDeliveryRecord(base, "dead-letter", { error: "offline" }, "2026-09-05T00:03:00.000Z");
  const doctor = doctorDingTalkIntegration({
    config,
    provider: createDingTalkProvider({ sendMessage: () => ({ ok: true, data: {} }) }),
    auth: { allowed: true },
    deliveries: [delivered, failed],
    deadLetters: [deadLetter],
    checkpoint: {
      provider: "dingtalk",
      subscription: "candidate",
      eventId: "event-1",
      occurredAt: "2026-09-05T00:00:00.000Z",
      updatedAt: "2026-09-05T00:01:00.000Z",
    },
    retry: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 60000 },
  });

  assert.equal(doctor.ok, false);
  assert.equal(doctor.provider.ok, true);
  assert.equal(doctor.config.secrets.webhookUrl, "[REDACTED]");
  assert.deepEqual(doctor.auth, { allowed: true });
  assert.equal(doctor.lastSuccess?.status, "delivered");
  assert.equal(doctor.lastFailure?.status, "dead-letter");
  assert.equal(doctor.checkpoint?.eventId, "event-1");
  assert.equal(doctor.retry?.maxAttempts, 3);
  assert.deepEqual(doctor.deadLetter.diagnostics[0], {
    id: "dingtalk:candidate:event-1",
    provider: "dingtalk",
    subscription: "candidate",
    eventId: "event-1",
    attempts: 0,
    error: "offline",
    updatedAt: "2026-09-05T00:03:00.000Z",
  });
});

test("dingtalk webhook transport sends signed markdown and normalizes errors", async () => {
  let sentUrl = "";
  let sentBody = "";
  const transport = createDingTalkWebhookTransport({
    url: "https://example.test/webhook",
    secret: "secret",
    now: () => 123,
    fetch: async (url, init) => {
      sentUrl = url;
      sentBody = init.body;
      return { ok: true, status: 200, json: async () => ({ errcode: 0, errmsg: "ok" }) };
    },
  });
  const result = await transport.sendMessage({ title: "Candidate", body: "Ready" });
  const expectedSign = encodeURIComponent(createHmac("sha256", "secret").update("123\nsecret").digest("base64"));

  assert.equal(signDingTalkWebhook(123, "secret"), expectedSign);
  assert.equal(dingTalkWebhookUrl("https://example.test/webhook", 123, "secret"), `${sentUrl}`);
  assert.equal(sentUrl, `https://example.test/webhook?timestamp=123&sign=${expectedSign}`);
  assert.equal(JSON.parse(sentBody).markdown.text, "Candidate\n\nReady");
  assert.equal(result.ok, true);

  const apiError = await createDingTalkWebhookTransport({
    url: "https://example.test/webhook",
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ errcode: 1, errmsg: "bad sign" }) }),
  }).sendMessage({ title: "Candidate" });
  const httpError = await createDingTalkWebhookTransport({
    url: "https://example.test/webhook",
    fetch: async () => ({ ok: false, status: 500, text: async () => "nope" }),
  }).sendMessage({ title: "Candidate" });

  assert.deepEqual(apiError, { ok: false, error: "bad sign", code: "DINGTALK_API" });
  assert.deepEqual(httpError, { ok: false, error: "DingTalk webhook HTTP 500", code: "DINGTALK_HTTP" });
});

test("dingtalk webhook transport times out", async () => {
  const result = await createDingTalkWebhookTransport({
    url: "https://example.test/webhook",
    timeoutMs: 1,
    fetch: (_url, init) =>
      new Promise((_, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      }),
  }).sendMessage({ title: "Candidate" });

  assert.deepEqual(result, { ok: false, error: "DingTalk webhook timeout", code: "DINGTALK_TIMEOUT" });
});

test("dingtalk renderer supports text markdown card and fallback", () => {
  const message = {
    title: "Candidate",
    summary: "Ready",
    sections: [{ title: "Confidence", facts: [{ label: "Score", value: "90%" }] }],
    actions: [{ id: "open", label: "Open", metadata: { url: "https://example.test/candidate" } }],
  };
  const text = renderDingTalkText(message);
  const markdown = renderDingTalkMarkdown(message);
  const card = renderDingTalkCard(message);
  const fallback = renderDingTalkCard({ title: "Candidate", actions: [{ id: "approve", label: "Approve" }] });

  assert.equal(text.msgtype, "text");
  assert.match(text.text.content, /Score: 90%/);
  assert.deepEqual(markdown, {
    msgtype: "markdown",
    markdown: {
      title: "Candidate",
      text: "Candidate\n\nReady\n\nConfidence\n- Score: 90%",
    },
  });
  assert.equal(card.msgtype, "actionCard");
  assert.deepEqual(card.actionCard.btns, [{ title: "Open", actionURL: "https://example.test/candidate" }]);
  assert.equal(fallback.msgtype, "markdown");
  assert.equal(renderDingTalkWebhookMessage(message).msgtype, "actionCard");
});

test("candidate created builder includes evidence confidence source and actions", () => {
  const message = createCandidateCreatedMessage({
    id: "event-1",
    schemaVersion: 1,
    type: "candidate.created",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: {
      id: "candidate-1",
      title: "Prompt reuse",
      summary: "Reuse a prompt pattern.",
      confidence: 0.82,
      source: "codex",
      evidence: [{ activity_id: "activity-1", reason: "Observed twice" }],
    },
  });

  assert.equal(message.title, "New Skill Candidate: Prompt reuse");
  assert.equal(message.sections?.[0]?.facts?.find((fact) => fact.label === "Confidence")?.value, "0.82");
  assert.equal(message.sections?.[0]?.facts?.find((fact) => fact.label === "Source")?.value, "codex");
  assert.equal(message.sections?.[0]?.facts?.find((fact) => fact.label === "activity-1")?.value, "Observed twice");
  assert.equal(message.actions?.[0]?.command, "candidate.approve");
  assert.equal(message.resources?.[0]?.externalId, "candidate-1");
  assert.equal(renderDingTalkWebhookMessage(message).msgtype, "markdown");
});

test("skill published builder includes skill version summary and link", () => {
  const message = createSkillPublishedMessage({
    id: "event-1",
    schemaVersion: 1,
    type: "skill.published",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: {
      name: "prompt-reuse",
      description: "Reuse prompt patterns.",
      revision: 3,
      url: "https://example.test/skills/prompt-reuse",
      published_at: "2026-09-03T00:00:00.000Z",
    },
  });

  assert.equal(message.title, "Skill Published: prompt-reuse");
  assert.equal(message.summary, "Reuse prompt patterns.");
  assert.equal(message.sections?.[0]?.facts?.find((fact) => fact.label === "Version")?.value, "revision 3");
  assert.equal(message.actions?.[0]?.metadata?.url, "https://example.test/skills/prompt-reuse");
  assert.equal(message.resources?.[0]?.externalId, "prompt-reuse");
  assert.equal(renderDingTalkWebhookMessage(message).msgtype, "actionCard");
});

test("governance builder includes finding reason suggestion and actions", () => {
  const message = createGovernanceMessage({
    id: "event-1",
    schemaVersion: 1,
    type: "governance.finding",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: {
      type: "stale",
      skill: "prompt-reuse",
      reason: "Skill has not been used recently.",
      suggestion: "Review whether to evolve or retire it.",
    },
  });

  assert.equal(message.title, "Governance: prompt-reuse");
  assert.equal(message.sections?.[0]?.facts?.find((fact) => fact.label === "Finding")?.value, "stale");
  assert.equal(
    message.sections?.[0]?.facts?.find((fact) => fact.label === "Reason")?.value,
    "Skill has not been used recently.",
  );
  assert.equal(
    message.sections?.[0]?.facts?.find((fact) => fact.label === "Suggestion")?.value,
    "Review whether to evolve or retire it.",
  );
  assert.equal(message.actions?.[0]?.command, "governance.resolve");
  assert.equal(message.actions?.[1]?.metadata?.action, "EVOLVE");
  assert.equal(renderDingTalkWebhookMessage(message).msgtype, "markdown");
});

test("foundry digest builder includes metrics summary and renders as markdown card", () => {
  const message = createFoundryDigestMessage({
    id: "event-1",
    schemaVersion: 1,
    type: "foundry.completed",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: {
      summary: "Foundry processed today's work.",
      activity_count: 4,
      candidate_count: 2,
      skill_count: 1,
      metrics: { "Token Estimate": 1200 },
    },
  });
  const rendered = renderDingTalkWebhookMessage(message);

  assert.equal(message.title, "Usora Foundry Digest");
  assert.equal(message.summary, "Foundry processed today's work.");
  assert.equal(message.sections?.[0]?.facts?.find((fact) => fact.label === "Activities")?.value, "4");
  assert.equal(message.sections?.[0]?.facts?.find((fact) => fact.label === "Token Estimate")?.value, "1200");
  assert.equal(rendered.msgtype, "markdown");
});

test("dingtalk outbound e2e wires event subscription renderer transport and delivery record", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-dingtalk-e2e-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const eventFile = path.join(cwd, "event.json");
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: { id: "candidate-1", title: "Prompt reuse", summary: "Reuse prompt patterns." },
  });
  let payload: { msgtype?: string; markdown?: { title?: string } } = {};
  await writeFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");

  const result = await runIntegrationRuntime({
    eventFiles: [eventFile],
    subscriptions: {
      subscriptions: [
        { id: "candidate-created", event: "candidate.created", provider: "dingtalk", message: "candidate" },
      ],
    },
    messages: createMessageBuilderRegistry([["candidate", (event) => createCandidateCreatedMessage(event)]]),
    providers: createDingTalkProviderRegistry(
      createDingTalkProvider(
        createDingTalkWebhookTransport({
          url: "https://example.test/webhook",
          fetch: async (_url, init) => {
            payload = JSON.parse(init.body);
            return { ok: true, status: 200, json: async () => ({ errcode: 0 }) };
          },
        }),
      ),
    ),
    stateDir: cwd,
    now: new Date("2026-09-03T00:01:00.000Z"),
  });
  const record = await readDeliveryRecord(
    path.join(cwd, "deliveries", `${encodeURIComponent("dingtalk:candidate-created:event-1")}.json`),
  );

  assert.equal(result.delivered, 1);
  assert.equal(payload.msgtype, "markdown");
  assert.equal(payload.markdown?.title, "New Skill Candidate: Prompt reuse");
  assert.equal(record?.status, "delivered");
});

test("dingtalk callback receiver verifies signatures and rejects malformed input", () => {
  const valid = parseDingTalkCallback({
    secret: "secret",
    headers: {
      "x-dingtalk-timestamp": "123",
      "x-dingtalk-signature": signDingTalkWebhook(123, "secret"),
    },
    body: JSON.stringify({
      callbackId: "callback-1",
      actionId: "candidate.approve",
      userId: "user-1",
      corpId: "corp-1",
    }),
  });

  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.callback.id, "callback-1");
    assert.equal(valid.callback.actionId, "candidate.approve");
    assert.equal(valid.callback.userId, "user-1");
    assert.equal(valid.callback.corpId, "corp-1");
  }
  assert.deepEqual(
    parseDingTalkCallback({
      secret: "secret",
      headers: { "x-dingtalk-timestamp": "123", "x-dingtalk-signature": "bad" },
      body: "{}",
    }),
    { ok: false, status: 401, error: "invalid signature" },
  );
  assert.deepEqual(parseDingTalkCallback({ body: "nope" }), {
    ok: false,
    status: 400,
    error: "malformed callback body",
  });
  assert.deepEqual(parseDingTalkCallback({ body: "{}" }), {
    ok: false,
    status: 400,
    error: "callback id, action id, and user id are required",
  });
});

test("dingtalk callback receipts block duplicates across replays", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-dingtalk-callback-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const callback = { id: "callback-1", actionId: "candidate.approve", userId: "user-1", payload: {} };
  const first = await claimDingTalkCallback(cwd, callback, "2026-09-03T00:00:00.000Z");
  const second = await claimDingTalkCallback(cwd, callback, "2026-09-03T00:01:00.000Z");

  assert.equal(first.ok, true);
  if (!first.ok) throw Error("expected callback claim");
  assert.deepEqual(first.receipt, {
    id: "callback-1",
    actionId: "candidate.approve",
    userId: "user-1",
    receivedAt: "2026-09-03T00:00:00.000Z",
  });
  assert.deepEqual(second, { ok: false, status: 409, error: "duplicate callback" });
  assert.deepEqual(await readDingTalkCallbackReceipt(dingTalkCallbackReceiptFile(cwd, "callback-1")), first.receipt);
});

test("dingtalk identity maps user tenant and unmapped users", async () => {
  const identity = dingTalkIdentityFromCallback({
    id: "callback-1",
    actionId: "candidate.approve",
    userId: "dt-user-1",
    corpId: "corp-1",
    payload: {},
  });
  const resolver = createDingTalkIdentityResolver({ "corp-1:dt-user-1": "user-1" });
  const actor = await resolver.resolveIdentity({
    provider: "dingtalk",
    externalUserId: identity.userId,
    externalTenantId: identity.corpId,
    displayName: "Ming",
  });

  assert.deepEqual(dingTalkExternalIdentity({ ...identity, displayName: "Ming" }), {
    provider: "dingtalk",
    externalUserId: "dt-user-1",
    externalTenantId: "corp-1",
    displayName: "Ming",
  });
  assert.equal(actor?.id, "user-1");
  assert.equal(actor?.identities?.[0]?.externalTenantId, "corp-1");
  assert.equal(await resolver.resolveIdentity({ provider: "dingtalk", externalUserId: "missing" }), null);
  assert.equal(await resolver.resolveIdentity({ provider: "other", externalUserId: "dt-user-1" }), null);
});

test("dingtalk authorization allows read candidate governance and gates maintainer actions", async () => {
  const authorizer = createDingTalkAuthorizer("maintainer");
  const user = { id: "user-1", kind: "user" as const };
  const maintainer = { id: "maintainer", kind: "user" as const };

  assert.equal((await authorizer.authorize({ actor: user, permission: "hub.status" })).allowed, true);
  assert.equal((await authorizer.authorize({ actor: user, permission: "candidate.approve" })).allowed, true);
  assert.equal((await authorizer.authorize({ actor: user, permission: "governance.evolve" })).allowed, true);
  assert.equal((await authorizer.authorize({ actor: user, permission: "governance.retire" })).allowed, false);
  assert.equal((await authorizer.authorize({ actor: maintainer, permission: "governance.retire" })).allowed, true);
  assert.equal((await authorizer.authorize({ actor: user, permission: "unknown.action" })).allowed, false);
});

test("dingtalk actions map callbacks to integration commands", () => {
  const actor = { id: "user-1", kind: "user" as const };
  const approve = createDingTalkActionCommand(
    {
      id: "callback-1",
      actionId: "candidate.approve",
      userId: "dt-user-1",
      payload: { candidateId: "candidate-1" },
    },
    actor,
    "2026-09-03T00:00:00.000Z",
  );
  const view = createDingTalkActionCommand(
    { id: "callback-2", actionId: "candidate.view", userId: "dt-user-1", payload: { candidateId: "candidate-1" } },
    actor,
  );
  const retire = createDingTalkActionCommand(
    { id: "callback-3", actionId: "governance.retire", userId: "dt-user-1", payload: { skill: "prompt-reuse" } },
    actor,
  );

  assert.equal(approve.name, "candidate.approve");
  assert.deepEqual(approve.args, { id: "candidate-1" });
  assert.equal(approve.source.provider, "dingtalk");
  assert.equal(view.name, "candidate.get");
  assert.deepEqual(retire.args, { skill: "prompt-reuse", action: "RETIRE" });
  assert.throws(
    () => createDingTalkActionCommand({ id: "callback-4", actionId: "bad", userId: "dt-user-1", payload: {} }, actor),
    /Unknown DingTalk action/,
  );
});

test("dingtalk dispatch claims authorizes maps and dispatches callback actions", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-dingtalk-dispatch-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  let calls = 0;
  let domainState = "active";
  const commands = createCommandRegistry([
    [
      "candidate.approve",
      (command) => {
        calls += 1;
        return { ok: true, data: command.args };
      },
    ],
    [
      "governance.resolve",
      () => {
        domainState = "retired";
        return { ok: true, data: { resolved: true } };
      },
    ],
  ]);
  const identities = createDingTalkIdentityResolver({ "corp-1:dt-user-1": "user-1" });
  const authorizer = createDingTalkAuthorizer("maintainer");
  const callback = {
    id: "callback-1",
    actionId: "candidate.approve",
    userId: "dt-user-1",
    corpId: "corp-1",
    payload: { candidateId: "candidate-1" },
  };

  assert.deepEqual(
    await dispatchDingTalkCallback({
      callback,
      stateDir: cwd,
      identities,
      authorizer,
      commands,
      now: "2026-09-03T00:00:00.000Z",
    }),
    { ok: true, data: { id: "candidate-1" } },
  );
  assert.deepEqual(await dispatchDingTalkCallback({ callback, stateDir: cwd, identities, authorizer, commands }), {
    ok: false,
    error: "duplicate callback",
    code: "DUPLICATE_CALLBACK",
  });
  assert.equal(calls, 1);
  assert.deepEqual(
    await dispatchDingTalkCallback({
      callback: { ...callback, id: "callback-2", actionId: "governance.retire", payload: { skill: "prompt-reuse" } },
      stateDir: cwd,
      identities,
      authorizer,
      commands,
    }),
    { ok: false, error: "Only the configured Maintainer can perform this action", code: "PERMISSION_DENIED" },
  );
  assert.equal(domainState, "active");
  assert.deepEqual(
    await dispatchDingTalkCallback({
      callback: { ...callback, id: "callback-3", userId: "missing" },
      stateDir: cwd,
      identities,
      authorizer,
      commands,
    }),
    { ok: false, error: "Unmapped DingTalk user", code: "UNMAPPED_USER" },
  );
});

test("dingtalk approve callback verifies identity authorizes emits approved event and feedback", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-dingtalk-approve-e2e-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const body = JSON.stringify({
    callbackId: "callback-approve-1",
    actionId: "candidate.approve",
    userId: "dt-user-1",
    corpId: "corp-1",
    candidateId: "candidate-1",
  });
  const parsed = parseDingTalkCallback({
    body,
    secret: "secret",
    headers: {
      "x-dingtalk-timestamp": "123",
      "x-dingtalk-signature": signDingTalkWebhook(123, "secret"),
    },
  });
  const emitted = [];
  let feedback;
  const commands = createCommandRegistry([
    [
      "candidate.approve",
      (command) => {
        emitted.push(
          createUsoraEvent({
            type: "candidate.approved",
            producer: { plugin: "foundry" },
            actor: command.actor,
            subject: { type: "candidate", id: String(command.args.id) },
            data: command.args,
          }),
        );
        feedback = createDingTalkBotResponse(command, { ok: true, data: { approved: true } });
        return { ok: true, data: { approved: true } };
      },
    ],
  ]);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw Error("expected parsed callback");
  const result = await dispatchDingTalkCallback({
    callback: parsed.callback,
    stateDir: cwd,
    identities: createDingTalkIdentityResolver({ "corp-1:dt-user-1": "user-1" }),
    authorizer: createDingTalkAuthorizer("maintainer"),
    commands,
  });

  assert.deepEqual(result, { ok: true, data: { approved: true } });
  assert.equal(emitted[0]?.type, "candidate.approved");
  assert.equal(emitted[0]?.subject?.id, "candidate-1");
  assert.equal(feedback?.title, "Usora Detail");
});

test("dingtalk inbound message parser normalizes envelope actor conversation and text", () => {
  const message = parseDingTalkInboundMessage({
    msgId: "msg-1",
    senderStaffId: "dt-user-1",
    senderNick: "Ming",
    conversationId: "conv-1",
    conversationTitle: "Usora",
    conversationCorpId: "corp-1",
    text: { content: "/status" },
  });

  assert.equal(message.id, "msg-1");
  assert.equal(message.actor.externalUserId, "dt-user-1");
  assert.equal(message.actor.externalTenantId, "corp-1");
  assert.equal(message.actor.displayName, "Ming");
  assert.equal(message.conversation.id, "conv-1");
  assert.equal(message.conversation.title, "Usora");
  assert.equal(message.text, "/status");
  assert.throws(() => parseDingTalkInboundMessage({ msgId: "msg-2" }), /message id/);
});

test("dingtalk resources map to provider neutral resources and provenance", () => {
  assert.deepEqual(
    ["document", "log", "todo", "conversation", "message", "calendar", "ai-table"].map((type) =>
      mapDingTalkResource({
        type: type as Parameters<typeof mapDingTalkResource>[0]["type"],
        id: `${type}-1`,
        title: type,
        url: "https://example.test/resource",
        corpId: "corp-1",
        conversationId: "conv-1",
      }),
    ),
    [
      {
        provider: "dingtalk",
        type: "document",
        externalId: "document-1",
        url: "https://example.test/resource",
        title: "document",
        metadata: { dingtalkType: "document", corpId: "corp-1", conversationId: "conv-1" },
      },
      {
        provider: "dingtalk",
        type: "log",
        externalId: "log-1",
        url: "https://example.test/resource",
        title: "log",
        metadata: { dingtalkType: "log", corpId: "corp-1", conversationId: "conv-1" },
      },
      {
        provider: "dingtalk",
        type: "todo",
        externalId: "todo-1",
        url: "https://example.test/resource",
        title: "todo",
        metadata: { dingtalkType: "todo", corpId: "corp-1", conversationId: "conv-1" },
      },
      {
        provider: "dingtalk",
        type: "conversation",
        externalId: "conversation-1",
        url: "https://example.test/resource",
        title: "conversation",
        metadata: { dingtalkType: "conversation", corpId: "corp-1", conversationId: "conv-1" },
      },
      {
        provider: "dingtalk",
        type: "message",
        externalId: "message-1",
        url: "https://example.test/resource",
        title: "message",
        metadata: { dingtalkType: "message", corpId: "corp-1", conversationId: "conv-1" },
      },
      {
        provider: "dingtalk",
        type: "calendar",
        externalId: "calendar-1",
        url: "https://example.test/resource",
        title: "calendar",
        metadata: { dingtalkType: "calendar", corpId: "corp-1", conversationId: "conv-1" },
      },
      {
        provider: "dingtalk",
        type: "document",
        externalId: "ai-table-1",
        url: "https://example.test/resource",
        title: "ai-table",
        metadata: { dingtalkType: "ai-table", corpId: "corp-1", conversationId: "conv-1" },
      },
    ],
  );
  assert.deepEqual(
    createDingTalkResourceProvenance(
      { type: "message", id: "msg-1", metadata: { sender: "dt-user-1" } },
      "codex",
      "2026-09-05T00:00:00.000Z",
    ),
    {
      resource: {
        provider: "dingtalk",
        type: "message",
        externalId: "msg-1",
        metadata: { dingtalkType: "message", sender: "dt-user-1" },
      },
      capturedAt: "2026-09-05T00:00:00.000Z",
      capturedBy: "codex",
    },
  );
});

test("dingtalk resource discovery filters list search scope and permission", () => {
  const resources = [
    { type: "document" as const, id: "doc-1", title: "Runbook", corpId: "corp-1" },
    { type: "message" as const, id: "msg-1", title: "Chat note", corpId: "corp-1", conversationId: "conv-1" },
    { type: "todo" as const, id: "todo-1", title: "Follow up", corpId: "corp-2" },
  ];

  assert.deepEqual(discoverDingTalkResources({ resources, permissions: [] }), []);
  assert.deepEqual(
    discoverDingTalkResources({ resources, permissions: ["resource.read"] }).map((resource) => resource.externalId),
    ["doc-1", "msg-1", "todo-1"],
  );
  assert.deepEqual(
    discoverDingTalkResources({ resources, q: "run", permissions: ["resource.read"] }).map(
      (resource) => resource.externalId,
    ),
    ["doc-1"],
  );
  assert.deepEqual(
    discoverDingTalkResources({
      resources,
      type: "message",
      scope: { corpId: "corp-1", conversationId: "conv-1" },
      permissions: ["resource.read"],
    }).map((resource) => resource.externalId),
    ["msg-1"],
  );
});

test("dingtalk resource read returns content metadata provenance and ignores deleted inaccessible", () => {
  const read = readDingTalkResource(
    {
      type: "document",
      id: "doc-1",
      title: "Runbook",
      content: "hello",
      corpId: "corp-1",
      metadata: { owner: "dt-user-1" },
    },
    "codex",
    "2026-09-05T00:00:00.000Z",
  );

  assert.equal(read?.content, "hello");
  assert.deepEqual(read?.metadata, { dingtalkType: "document", corpId: "corp-1", owner: "dt-user-1" });
  assert.equal(read?.provenance.resource.externalId, "doc-1");
  assert.equal(read?.provenance.capturedBy, "codex");
  assert.equal(readDingTalkResource({ type: "message", id: "msg-1", deleted: true }), null);
  assert.equal(readDingTalkResource({ type: "message", id: "msg-2", inaccessible: true }), null);
});

test("dingtalk source capability normalizes resources into foundry activity input", () => {
  const resource = { type: "document" as const, id: "doc-1", title: "Runbook", content: "Operational notes." };
  const activity = normalizeDingTalkResourceActivity(resource, "codex", "2026-09-05T00:00:00.000Z");
  const source = createDingTalkSourceCapability([resource]);

  assert.equal(activity?.source, "dingtalk");
  assert.equal(activity?.task, "Captured DingTalk document: Runbook");
  assert.equal(activity?.result, "Operational notes.");
  assert.equal(activity?.metadata.resource.externalId, "doc-1");
  const captured = source.capture(mapDingTalkResource(resource));
  assert.equal(captured.ok, true);
  if (!captured.ok) throw Error("expected source capture");
  assert.equal(captured.data.metadata.resource.externalId, "doc-1");
  assert.equal(captured.data.result, "Operational notes.");
  assert.deepEqual(source.capture({ provider: "dingtalk", type: "document", externalId: "missing" }), {
    ok: false,
    error: "DingTalk resource is unavailable",
    code: "DINGTALK_RESOURCE_UNAVAILABLE",
  });
});

test("dingtalk manual capture supports document conversation log with provenance activity", () => {
  for (const resource of [
    { type: "document" as const, id: "doc-1", title: "Runbook", content: "Operational notes." },
    { type: "conversation" as const, id: "conv-1", title: "Team chat", content: "Decision thread." },
    { type: "log" as const, id: "log-1", title: "Deploy log", content: "Deployment finished." },
  ]) {
    const captured = manualCaptureDingTalkResource(resource, "codex", "2026-09-05T00:00:00.000Z");

    assert.equal(captured.ok, true);
    if (!captured.ok) throw Error("expected manual capture");
    assert.equal(captured.data.source, "dingtalk");
    assert.equal(captured.data.metadata.resource.externalId, resource.id);
    assert.equal(captured.data.metadata.provenance.capturedBy, "codex");
    assert.equal(captured.data.result, resource.content);
  }

  assert.deepEqual(manualCaptureDingTalkResource({ type: "todo", id: "todo-1" }, "codex"), {
    ok: false,
    error: "Manual capture does not support DingTalk todo",
    code: "DINGTALK_CAPTURE_UNSUPPORTED",
  });
  assert.deepEqual(manualCaptureDingTalkResource({ type: "log", id: "log-2", deleted: true }, "codex"), {
    ok: false,
    error: "DingTalk resource is unavailable",
    code: "DINGTALK_RESOURCE_UNAVAILABLE",
  });
});

test("dingtalk automatic capture applies allowlist scope retention dedup and privacy", () => {
  const captured = automaticCaptureDingTalkResources(
    [
      {
        type: "document",
        id: "doc-1",
        title: "Runbook",
        content: "Operational notes.",
        corpId: "corp-1",
        conversationId: "conv-1",
        metadata: { updatedAt: "2026-09-04T00:00:00.000Z" },
      },
      {
        type: "document",
        id: "doc-1",
        title: "Duplicate",
        content: "Should not capture twice.",
        corpId: "corp-1",
        conversationId: "conv-1",
      },
      {
        type: "conversation",
        id: "conv-2",
        title: "Other chat",
        content: "Wrong scope.",
        corpId: "corp-1",
        conversationId: "conv-2",
      },
      {
        type: "log",
        id: "log-1",
        title: "Old log",
        content: "Expired.",
        corpId: "corp-1",
        conversationId: "conv-1",
        metadata: { updatedAt: "2026-09-01T00:00:00.000Z" },
      },
      {
        type: "document",
        id: "doc-2",
        title: "Private note",
        content: "Do not capture.",
        corpId: "corp-1",
        conversationId: "conv-1",
        metadata: { private: true },
      },
      {
        type: "message",
        id: "msg-1",
        title: "Unlisted message",
        content: "Not allowlisted.",
        corpId: "corp-1",
        conversationId: "conv-1",
      },
    ],
    {
      allowlist: ["document", "conversation", "log"],
      scope: { corpId: "corp-1", conversationId: "conv-1" },
      retentionDays: 2,
      now: "2026-09-05T00:00:00.000Z",
      capturedBy: "codex",
    },
  );

  assert.equal(captured.ok, true);
  if (!captured.ok) throw Error("expected automatic capture");
  assert.deepEqual(
    captured.data.map((activity) => activity.metadata.resource.externalId),
    ["doc-1"],
  );
  assert.equal(captured.data[0]?.metadata.provenance.capturedBy, "codex");
});

test("dingtalk practice source flows into foundry activity pattern and candidate", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-dingtalk-practice-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));

  const captured = automaticCaptureDingTalkResources(
    [
      {
        type: "document",
        id: "doc-runbook",
        title: "DingTalk runbook",
        content: "Capture DingTalk operational decisions into reusable Usora practice.",
        corpId: "corp-1",
        metadata: { high_value: true, updatedAt: "2026-09-05T00:00:00.000Z" },
      },
    ],
    { allowlist: ["document"], now: "2026-09-05T00:00:00.000Z", capturedBy: "codex" },
  );

  assert.equal(captured.ok, true);
  if (!captured.ok) throw Error("expected automatic capture");
  const activity = captured.data[0];
  assert.ok(activity);

  const indexed = await runFoundryMcp(cwd, [
    foundryInitialize,
    foundryCall(2, "hub_init"),
    foundryCall(3, "activity_capture", {
      ...activity,
      session_id: "dingtalk-doc-runbook",
      project: "dingtalk",
      technologies: ["DingTalk", "Usora Foundry"],
    }),
    foundryCall(4, "pattern_index"),
    foundryCall(5, "pattern_query", { fields: ["fingerprint", "activity_refs", "source_hosts"], limit: 1 }),
  ]);
  assert.deepEqual(foundryBody(indexed[3]), { mode: "incremental", indexed: 1, patterns: 1 });
  const pattern = foundryBody(indexed[4]).patterns[0];

  const created = await runFoundryMcp(cwd, [
    foundryInitialize,
    foundryCall(6, "candidate_create", {
      title: "DingTalk practice capture",
      summary: "Reuse DingTalk operational decisions as Usora practice evidence.",
      fingerprint: pattern.fingerprint,
      evidence: pattern.activity_refs,
      source_hosts: pattern.source_hosts,
    }),
  ]);
  const candidate = foundryBody(created[1]);

  assert.equal(candidate.title, "DingTalk practice capture");
  assert.equal(candidate.fingerprint, pattern.fingerprint);
  assert.deepEqual(candidate.evidence, pattern.activity_refs);
  assert.deepEqual(candidate.contributing_sources, pattern.source_hosts);
});

test("dingtalk bot parser maps status candidates skill governance foundry and digest", () => {
  assert.deepEqual(parseDingTalkBotCommand("/status"), { name: "hub.status", args: {} });
  assert.deepEqual(parseDingTalkBotCommand("/candidates"), { name: "candidate.list", args: {} });
  assert.deepEqual(parseDingTalkBotCommand("/candidate candidate-1"), {
    name: "candidate.get",
    args: { id: "candidate-1" },
  });
  assert.deepEqual(parseDingTalkBotCommand("/skill prompt-reuse"), {
    name: "skill.get",
    args: { name: "prompt-reuse" },
  });
  assert.deepEqual(parseDingTalkBotCommand("/governance"), { name: "governance.scan", args: {} });
  assert.deepEqual(parseDingTalkBotCommand("/foundry run"), { name: "foundry.run", args: {} });
  assert.deepEqual(parseDingTalkBotCommand("/digest"), { name: "digest.get", args: {} });
  assert.equal(parseDingTalkBotCommand("/unknown"), null);
});

test("dingtalk bot responses cover status list detail permission denied and error", () => {
  const base = {
    id: "cmd-1",
    actor: { id: "user-1", kind: "user" as const },
    args: {},
    source: { provider: "dingtalk" },
    issuedAt: "2026-09-03T00:00:00.000Z",
  };
  const status = createDingTalkBotResponse({ ...base, name: "hub.status" }, { ok: true, data: { initialized: true } });
  const list = createDingTalkBotResponse(
    { ...base, name: "candidate.list" },
    { ok: true, data: { candidates: [{ id: "candidate-1" }] } },
  );
  const detail = createDingTalkBotResponse(
    { ...base, name: "skill.get" },
    { ok: true, data: { name: "prompt-reuse" } },
  );
  const denied = createDingTalkBotResponse(
    { ...base, name: "governance.resolve" },
    { ok: false, error: "no", code: "PERMISSION_DENIED" },
  );
  const error = createDingTalkBotResponse({ ...base, name: "foundry.run" }, { ok: false, error: "boom" });

  assert.equal(status.title, "Usora Status");
  assert.equal(list.summary, "1 item(s) found.");
  assert.equal(detail.title, "Usora Detail");
  assert.equal(denied.title, "Permission denied");
  assert.equal(error.title, "Command failed");
});

test("dingtalk app client caches tokens and sends authenticated requests", async () => {
  let now = 1_000;
  const calls: Array<{ url: string; body?: string; token?: string }> = [];
  const client = createDingTalkAppClient({
    appKey: "key",
    appSecret: "secret",
    baseUrl: "https://api.example.test",
    now: () => now,
    fetch: async (url, init) => {
      calls.push({ url, body: init.body, token: init.headers["x-acs-dingtalk-access-token"] });
      if (url.endsWith("/v1.0/oauth2/accessToken")) {
        return { ok: true, status: 200, json: async () => ({ accessToken: `token-${calls.length}`, expireIn: 120 }) };
      }
      return { ok: true, status: 200, json: async () => ({ code: "0", sent: true }) };
    },
  });

  assert.equal((await client.getAccessToken()).ok, true);
  assert.equal((await client.getAccessToken()).ok, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(await client.request("/v1.0/messages", { body: { text: "hello" } }), {
    ok: true,
    data: { code: "0", sent: true },
  });
  assert.equal(calls[1]?.token, "token-1");

  now = 62_000;
  assert.equal((await client.getAccessToken()).ok, true);
  assert.equal(calls.length, 3);
});

test("dingtalk app client normalizes token and API errors", async () => {
  const http = await createDingTalkAppClient({
    appKey: "key",
    appSecret: "secret",
    fetch: async () => ({ ok: false, status: 500, text: async () => "down" }),
  }).getAccessToken();
  const badToken = await createDingTalkAppClient({
    appKey: "key",
    appSecret: "secret",
    fetch: async () => ({ ok: true, status: 200, json: async () => ({ code: "0" }) }),
  }).getAccessToken();
  const api = await createDingTalkAppClient({
    appKey: "key",
    appSecret: "secret",
    fetch: async (url) =>
      url.endsWith("/v1.0/oauth2/accessToken")
        ? { ok: true, status: 200, json: async () => ({ accessToken: "token", expireIn: 120 }) }
        : { ok: true, status: 200, json: async () => ({ code: "bad", message: "bad request" }) },
  }).request("/v1.0/messages");

  assert.deepEqual(http, { ok: false, error: "DingTalk app HTTP 500", code: "DINGTALK_HTTP" });
  assert.deepEqual(badToken, {
    ok: false,
    error: "DingTalk access token response is invalid",
    code: "DINGTALK_TOKEN",
  });
  assert.deepEqual(api, { ok: false, error: "bad request", code: "DINGTALK_API" });
});
