import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import {
  INTEGRATION_CONTRACT_VERSION,
  INTEGRATION_PACKAGE,
  USORA_EVENT_SCHEMA_VERSION,
  assertProviderContract,
  advanceCheckpoint,
  buildSubscriptionMessage,
  createIntegrationHarness,
  createDeliveryRecord,
  createCommandRegistry,
  createMessageBuilderRegistry,
  createMockIntegrationProvider,
  createProviderRegistry,
  createResourceProvenance,
  createMaintainerAuthorizer,
  createUsoraEvent,
  deadLetterDiagnostic,
  dispatchIntegrationCommand,
  fromLegacyFoundryEvent,
  hasExternalIdentity,
  matchSubscriptions,
  mockIntegrationAction,
  mockIntegrationEvent,
  mockIntegrationIdentity,
  mockIntegrationResource,
  normalizeEventType,
  readDeadLetter,
  readCheckpoint,
  readDeliveryRecord,
  replayDeadLetter,
  retryDelayMs,
  runIntegrationRuntime,
  scheduleRetry,
  shouldStartDelivery,
  updateDeliveryRecord,
  validateIntegrationMessage,
  validateUsoraEvent,
  writeDeadLetter,
  writeCheckpoint,
  writeDeliveryRecord,
} from "../../packages/integration/src/index.ts";

test("integration package exports its contract version", () => {
  assert.equal(INTEGRATION_PACKAGE, "@usora/integration");
  assert.equal(INTEGRATION_CONTRACT_VERSION, 1);
});

test("testing sdk creates harness and mock integration objects", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-harness-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const harness = createIntegrationHarness({ stateDir: cwd });
  const event = mockIntegrationEvent({ id: "event-test", data: { title: "Harness Message" } });

  const result = await harness.runEvent(event);

  assert.equal(result.delivered, 1);
  assert.equal(harness.sentMessages[0]?.title, "Harness Message");
  assert.deepEqual(mockIntegrationIdentity({ id: "actor-1" }), { id: "actor-1", kind: "user" });
  assert.equal(mockIntegrationAction({ id: "candidate.approve" }).id, "candidate.approve");
  assert.equal(mockIntegrationResource({ externalId: "doc-1" }).externalId, "doc-1");
});

test("retry scheduling is bounded and sends exhausted records to dead letter", () => {
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    producer: { plugin: "foundry" },
    data: {},
  });
  const record = updateDeliveryRecord(
    createDeliveryRecord({ provider: "dingtalk", subscription: "candidate-created", event }),
    "delivering",
  );
  const failed = scheduleRetry(
    record,
    new Error("timeout"),
    { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 1500 },
    new Date("2026-09-03T00:00:00.000Z"),
  );
  const exhausted = scheduleRetry(
    { ...failed, attempts: 2 },
    new Error("still down"),
    { maxAttempts: 2, baseDelayMs: 1000, maxDelayMs: 1500 },
    new Date("2026-09-03T00:00:10.000Z"),
  );

  assert.equal(retryDelayMs(3, { maxAttempts: 5, baseDelayMs: 1000, maxDelayMs: 2500 }), 2500);
  assert.equal(failed.status, "failed");
  assert.equal(failed.nextAttemptAt, "2026-09-03T00:00:01.000Z");
  assert.equal(exhausted.status, "dead-letter");
  assert.equal(scheduleRetry(record, { retryable: false }).status, "dead-letter");
});

test("delivery records use provider subscription event dedup keys", () => {
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    producer: { plugin: "foundry" },
    data: {},
  });
  const pending = createDeliveryRecord({
    provider: "dingtalk",
    subscription: "candidate-created",
    event,
    message: { title: "Candidate" },
    now: "2026-09-03T00:00:00.000Z",
  });
  const delivering = updateDeliveryRecord(pending, "delivering", {}, "2026-09-03T00:01:00.000Z");
  const failed = updateDeliveryRecord(
    delivering,
    "failed",
    { error: "timeout", nextAttemptAt: "2026-09-03T00:02:00.000Z" },
    "2026-09-03T00:01:30.000Z",
  );

  assert.equal(pending.id, "dingtalk:candidate-created:event-1");
  assert.equal(pending.status, "pending");
  assert.equal(delivering.attempts, 1);
  assert.equal(failed.status, "failed");
  assert.equal(failed.error, "timeout");
  assert.equal(shouldStartDelivery(pending), true);
  assert.equal(shouldStartDelivery(failed), true);
  assert.equal(shouldStartDelivery(updateDeliveryRecord(delivering, "delivered")), false);
  assert.equal(shouldStartDelivery(updateDeliveryRecord(failed, "dead-letter")), false);
});

test("checkpoints advance only after delivered events and persist atomically", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-checkpoint-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const file = path.join(cwd, "checkpoint.json");
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: {},
  });
  const pending = createDeliveryRecord({ provider: "dingtalk", subscription: "candidate-created", event });
  const delivered = updateDeliveryRecord(pending, "delivered");

  assert.equal(advanceCheckpoint(null, event, pending), null);
  const checkpoint = advanceCheckpoint(null, event, delivered, "2026-09-03T00:01:00.000Z");
  assert.equal(checkpoint?.eventId, "event-1");
  assert.equal(
    advanceCheckpoint(checkpoint, { ...event, id: "older", occurredAt: "2026-09-02T00:00:00.000Z" }, delivered),
    checkpoint,
  );

  await writeCheckpoint(file, checkpoint!);
  assert.deepEqual(await readCheckpoint(file), checkpoint);
});

test("dead letters persist diagnostics and replay to pending", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-dead-letter-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const file = path.join(cwd, "dead-letter.json");
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    producer: { plugin: "foundry" },
    data: {},
  });
  const record = scheduleRetry(
    { ...createDeliveryRecord({ provider: "dingtalk", subscription: "candidate-created", event }), attempts: 3 },
    new Error("offline"),
    { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 1000 },
    new Date("2026-09-03T00:00:00.000Z"),
  );

  await writeDeadLetter(file, record);
  assert.deepEqual(await readDeadLetter(file), record);
  assert.deepEqual(deadLetterDiagnostic(record), {
    id: "dingtalk:candidate-created:event-1",
    provider: "dingtalk",
    subscription: "candidate-created",
    eventId: "event-1",
    attempts: 3,
    error: "offline",
    updatedAt: "2026-09-03T00:00:00.000Z",
  });
  const replayed = replayDeadLetter(record, "2026-09-03T00:01:00.000Z");
  const { error: _error, nextAttemptAt: _nextAttemptAt, ...recordWithoutRetryState } = record;
  assert.deepEqual(replayed, {
    ...recordWithoutRetryState,
    status: "pending",
    attempts: 0,
    updatedAt: "2026-09-03T00:01:00.000Z",
  });
  assert.equal("error" in replayed, false);
  assert.rejects(() => writeDeadLetter(file, replayDeadLetter(record)), /dead-letter status/);
});

test("subscriptions match events and build neutral messages", () => {
  const event = createUsoraEvent({
    type: "candidate.created",
    producer: { plugin: "foundry" },
    data: { title: "New Candidate" },
  });
  const [match] = matchSubscriptions(event, {
    subscriptions: [
      { id: "candidate-created", event: "candidate.created", provider: "dingtalk", message: "candidate-created" },
      { id: "disabled", event: "candidate.created", provider: "console", message: "candidate-created", enabled: false },
      { id: "skill-published", event: "skill.published", provider: "dingtalk", message: "skill-published" },
    ],
  });
  const builders = createMessageBuilderRegistry([
    ["candidate-created", () => ({ title: "New Skill Candidate", body: "New Candidate" })],
  ]);

  assert.equal(match?.subscription.id, "candidate-created");
  assert.equal(match?.subscription.provider, "dingtalk");
  assert.equal(buildSubscriptionMessage(match!, builders).title, "New Skill Candidate");
  assert.throws(() => buildSubscriptionMessage(match!, createMessageBuilderRegistry()), /Unknown message builder/);
});

test("provider contract validates declared capabilities", () => {
  const provider = assertProviderContract({
    id: "test-provider",
    capabilities: { messaging: true },
    messaging: { sendMessage: () => ({ ok: true, data: { delivered: true } }) },
  });

  assert.equal(provider.id, "test-provider");
  assert.throws(
    () => assertProviderContract({ id: "bad-provider", capabilities: { messaging: true } }),
    /declares missing messaging/,
  );
});

test("provider registry validates duplicates capabilities and disabled providers", () => {
  const dingtalk = {
    id: "dingtalk",
    capabilities: { messaging: true },
    messaging: { sendMessage: () => ({ ok: true, data: { delivered: true } }) },
  };
  const registry = createProviderRegistry([
    dingtalk,
    {
      id: "console",
      enabled: false,
      capabilities: { messaging: true },
      messaging: { sendMessage: () => ({ ok: true, data: { delivered: true } }) },
    },
  ]);

  assert.equal(registry.get("console")?.enabled, false);
  assert.deepEqual(
    registry.list("messaging").map((provider) => provider.id),
    ["dingtalk"],
  );
  assert.equal(registry.require("dingtalk").id, "dingtalk");
  assert.throws(() => registry.require("missing"), /Unknown provider/);
  assert.throws(() => registry.register(dingtalk), /Duplicate provider/);
  assert.throws(
    () => createProviderRegistry([{ id: "bad-provider", capabilities: { messaging: true } }]),
    /declares missing messaging/,
  );
});

test("runtime consumes event files without repeating delivered side effects", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-runtime-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const eventFile = path.join(cwd, "event.json");
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: { title: "Candidate" },
  });
  let sends = 0;
  const providers = createProviderRegistry([
    {
      id: "dingtalk",
      capabilities: { messaging: true },
      messaging: {
        sendMessage: () => {
          sends += 1;
          return { ok: true, data: { delivered: true } };
        },
      },
    },
  ]);
  const subscriptions = {
    subscriptions: [
      { id: "candidate-created", event: "candidate.created", provider: "dingtalk", message: "candidate" },
    ],
  };
  const messages = createMessageBuilderRegistry([["candidate", () => ({ title: "Candidate" })]]);

  await writeFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");
  const first = await runIntegrationRuntime({
    eventFiles: [eventFile],
    subscriptions,
    messages,
    providers,
    stateDir: cwd,
    now: new Date("2026-09-03T00:01:00.000Z"),
  });
  const second = await runIntegrationRuntime({
    eventFiles: [eventFile],
    subscriptions,
    messages,
    providers,
    stateDir: cwd,
    now: new Date("2026-09-03T00:02:00.000Z"),
  });

  assert.equal(sends, 1);
  assert.equal(first.delivered, 1);
  assert.equal(second.skipped, 1);
  assert.equal(
    (await readCheckpoint(path.join(cwd, "checkpoints", `${encodeURIComponent("dingtalk:candidate-created")}.json`)))
      ?.eventId,
    "event-1",
  );
});

test("runtime recovers checkpoint after delivered record survives a crash", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-runtime-crash-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const eventFile = path.join(cwd, "event.json");
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: { title: "Candidate" },
  });
  let sends = 0;
  const pending = createDeliveryRecord({
    provider: "dingtalk",
    subscription: "candidate-created",
    event,
    message: { title: "Candidate" },
  });

  await writeFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");
  await writeDeliveryRecord(
    path.join(cwd, "deliveries", `${encodeURIComponent(pending.id)}.json`),
    updateDeliveryRecord(pending, "delivered", {}, "2026-09-03T00:01:00.000Z"),
  );
  const result = await runIntegrationRuntime({
    eventFiles: [eventFile],
    subscriptions: {
      subscriptions: [
        { id: "candidate-created", event: "candidate.created", provider: "dingtalk", message: "candidate" },
      ],
    },
    messages: createMessageBuilderRegistry([["candidate", () => ({ title: "Candidate" })]]),
    providers: createProviderRegistry([
      {
        id: "dingtalk",
        capabilities: { messaging: true },
        messaging: {
          sendMessage: () => {
            sends += 1;
            return { ok: true, data: { delivered: true } };
          },
        },
      },
    ]),
    stateDir: cwd,
    now: new Date("2026-09-03T00:02:00.000Z"),
  });

  assert.equal(sends, 0);
  assert.equal(result.skipped, 1);
  assert.equal(
    (await readCheckpoint(path.join(cwd, "checkpoints", `${encodeURIComponent("dingtalk:candidate-created")}.json`)))
      ?.eventId,
    "event-1",
  );
});

test("runtime treats corrupted delivery state as pending work", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-runtime-corrupt-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const eventFile = path.join(cwd, "event.json");
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    producer: { plugin: "foundry" },
    data: { title: "Candidate" },
  });
  let sends = 0;
  const record = createDeliveryRecord({ provider: "dingtalk", subscription: "candidate-created", event });

  await writeFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");
  await mkdir(path.join(cwd, "deliveries"), { recursive: true });
  await writeFile(path.join(cwd, "deliveries", `${encodeURIComponent(record.id)}.json`), "{broken", "utf8");
  const result = await runIntegrationRuntime({
    eventFiles: [eventFile],
    subscriptions: {
      subscriptions: [
        { id: "candidate-created", event: "candidate.created", provider: "dingtalk", message: "candidate" },
      ],
    },
    messages: createMessageBuilderRegistry([["candidate", () => ({ title: "Candidate" })]]),
    providers: createProviderRegistry([
      {
        id: "dingtalk",
        capabilities: { messaging: true },
        messaging: {
          sendMessage: () => {
            sends += 1;
            return { ok: true, data: { delivered: true } };
          },
        },
      },
    ]),
    stateDir: cwd,
  });

  assert.equal(sends, 1);
  assert.equal(result.delivered, 1);
  assert.equal(
    (await readDeliveryRecord(path.join(cwd, "deliveries", `${encodeURIComponent(record.id)}.json`)))?.status,
    "delivered",
  );
});

test("runtime fans out one event and message builder to a second provider", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-runtime-fanout-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const eventFile = path.join(cwd, "event.json");
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    occurredAt: "2026-09-03T00:00:00.000Z",
    producer: { plugin: "foundry" },
    data: { title: "Candidate" },
  });
  const dingtalk = createMockIntegrationProvider("dingtalk");
  const consoleProvider = createMockIntegrationProvider("console");
  const providers = createProviderRegistry([dingtalk.provider, consoleProvider.provider]);
  const subscriptions = {
    subscriptions: [
      { id: "candidate-dingtalk", event: "candidate.created", provider: "dingtalk", message: "candidate" },
      { id: "candidate-console", event: "candidate.created", provider: "console", message: "candidate" },
    ],
  };
  const messages = createMessageBuilderRegistry([["candidate", () => ({ title: "Candidate" })]]);

  await writeFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");
  const result = await runIntegrationRuntime({
    eventFiles: [eventFile],
    subscriptions,
    messages,
    providers,
    stateDir: cwd,
  });

  assert.equal(result.delivered, 2);
  assert.equal(dingtalk.sentMessages[0]?.title, "Candidate");
  assert.ok(dingtalk.sentMessages[0]?.id);
  assert.equal(consoleProvider.sentMessages[0]?.title, dingtalk.sentMessages[0]?.title);
  assert.notEqual(consoleProvider.sentMessages[0]?.id, dingtalk.sentMessages[0]?.id);
  assert.equal(providers.require("console").id, "console");
});

test("runtime sends exhausted failures to dead letter diagnostics", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-runtime-dead-letter-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const eventFile = path.join(cwd, "legacy-event.json");
  await writeFile(
    eventFile,
    `${JSON.stringify({
      schema_version: 1,
      type: "CandidateCreated",
      timestamp: "2026-09-03T00:00:00.000Z",
      data: { title: "Candidate" },
    })}\n`,
    "utf8",
  );

  const result = await runIntegrationRuntime({
    eventFiles: [eventFile],
    subscriptions: {
      subscriptions: [
        { id: "candidate-created", event: "candidate.created", provider: "dingtalk", message: "candidate" },
      ],
    },
    messages: createMessageBuilderRegistry([["candidate", () => ({ title: "Candidate" })]]),
    providers: createProviderRegistry([
      {
        id: "dingtalk",
        capabilities: { messaging: true },
        messaging: { sendMessage: () => ({ ok: false, error: "offline" }) },
      },
    ]),
    stateDir: cwd,
    retry: { maxAttempts: 1, baseDelayMs: 1000, maxDelayMs: 1000 },
    now: new Date("2026-09-03T00:01:00.000Z"),
  });

  assert.equal(result.deadLettered, 1);
  assert.equal(result.diagnostics[0]?.error, "offline");
  assert.equal(result.diagnostics[0]?.eventId, "legacy-event");
});

test("command dispatcher validates registry and authorization", async () => {
  const registry = createCommandRegistry([
    ["hub.status", () => ({ ok: true, data: { initialized: true } })],
    ["governance.resolve", () => ({ ok: true, data: { action: "RETIRE" } })],
  ]);
  const actor = { id: "user-1", kind: "user" as const };
  const base = {
    id: "cmd-1",
    actor,
    args: {},
    source: { provider: "dingtalk" },
    issuedAt: "2026-09-03T00:00:00.000Z",
  };
  const authorizer = createMaintainerAuthorizer("codex", ["governance.resolve"]);

  assert.deepEqual(await dispatchIntegrationCommand(registry, { ...base, name: "hub.status" }, authorizer), {
    ok: true,
    data: { initialized: true },
  });
  assert.equal(
    (await dispatchIntegrationCommand(registry, { ...base, name: "governance.resolve" }, authorizer)).code,
    "PERMISSION_DENIED",
  );
  assert.equal(
    (await dispatchIntegrationCommand(registry, { ...base, name: "missing.command" }, authorizer)).code,
    "UNKNOWN_COMMAND",
  );
});

test("resources carry provider-neutral provenance", () => {
  const provenance = createResourceProvenance(
    {
      provider: "dingtalk",
      type: "document",
      externalId: "doc-1",
      title: "Runbook",
      url: "https://example.test/doc-1",
    },
    "codex",
    "2026-09-03T00:00:00.000Z",
  );

  assert.equal(provenance.resource.provider, "dingtalk");
  assert.equal(provenance.resource.type, "document");
  assert.equal(provenance.capturedBy, "codex");
  assert.equal(provenance.capturedAt, "2026-09-03T00:00:00.000Z");
});

test("messages validate neutral content and actions", () => {
  const message = validateIntegrationMessage({
    title: "New Skill Candidate",
    sections: [{ title: "Confidence", facts: [{ label: "Score", value: "87%" }] }],
    actions: [{ id: "candidate.approve", label: "Approve", command: "candidate.approve", style: "primary" }],
    resources: [{ provider: "foundry", type: "card", externalId: "candidate-1" }],
  });

  assert.equal(message.actions?.[0]?.command, "candidate.approve");
  assert.throws(() => validateIntegrationMessage({ actions: [{ id: "", label: "Approve" }] }), /must include/);
});

test("createUsoraEvent fills required envelope fields", () => {
  const event = createUsoraEvent({
    type: "activity.created",
    producer: { plugin: "foundry", version: "1.5.0" },
    actor: { id: "codex", kind: "agent" },
    subject: { type: "activity", id: "activity-1" },
    data: { id: "activity-1" },
    metadata: { source: "test" },
  });

  assert.match(event.id, /^event-/);
  assert.equal(event.schemaVersion, USORA_EVENT_SCHEMA_VERSION);
  assert.equal(event.type, "activity.created");
  assert.equal(event.producer.plugin, "foundry");
  assert.equal(event.actor?.kind, "agent");
  assert.equal(event.subject?.id, "activity-1");
  assert.deepEqual(event.data, { id: "activity-1" });
  assert.equal(Number.isNaN(Date.parse(event.occurredAt)), false);
});

test("legacy Foundry events adapt to the public event envelope", () => {
  const event = fromLegacyFoundryEvent({
    schema_version: 1,
    type: "CandidateCreated",
    timestamp: "2026-09-03T00:00:00.000Z",
    data: { id: "candidate-1" },
    file: "123-event-abcd.json",
  });

  assert.equal(event.id, "123-event-abcd");
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.type, "candidate.created");
  assert.equal(event.occurredAt, "2026-09-03T00:00:00.000Z");
  assert.deepEqual(event.data, { id: "candidate-1" });
  assert.equal(event.metadata?.legacyType, "CandidateCreated");
  assert.equal(validateUsoraEvent(event), event);
  assert.equal(normalizeEventType("already.dotted"), "already.dotted");
});

test("identity helpers keep external users separate from Maintainer authorization", async () => {
  const actor = {
    id: "user-1",
    kind: "user" as const,
    identities: [{ provider: "dingtalk", externalUserId: "dt-1", externalTenantId: "corp-1" }],
  };
  const authorizer = createMaintainerAuthorizer("codex", ["governance.retire"]);

  assert.equal(hasExternalIdentity(actor, { provider: "dingtalk", externalUserId: "dt-1" }), true);
  assert.equal((await authorizer.authorize({ actor, permission: "candidate.view" })).allowed, true);
  assert.equal((await authorizer.authorize({ actor, permission: "governance.retire" })).allowed, false);
  assert.equal(
    (await authorizer.authorize({ actor: { id: "codex", kind: "agent" }, permission: "governance.retire" })).allowed,
    true,
  );
});
