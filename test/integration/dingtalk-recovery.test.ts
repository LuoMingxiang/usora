import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { test, vi } from "vitest";
import {
  createUsoraEvent,
  createDeliveryRecord,
  updateDeliveryRecord,
  writeDeliveryRecord,
  readDeliveryRecord,
  runIntegrationRuntime,
  createProviderRegistry,
  createMessageBuilderRegistry,
  withIntegrationLock,
  createCommandRegistry,
} from "../../packages/integration/src/index.ts";
import {
  dispatchDingTalkCallback,
  createDingTalkAuthorizer,
  createDingTalkIdentityResolver,
  parseDingTalkBotCommand,
  createCandidateCreatedMessage,
} from "../../plugins/dingtalk/src/index.ts";
import { createFoundryClient, createFoundryCommands } from "../../plugins/dingtalk/src/foundry.ts";
import { createDingTalkService } from "../../plugins/dingtalk/src/service.ts";
import { createDingTalkCardTransport, cardFile } from "../../plugins/dingtalk/src/cards.ts";
import { fetchDingTalkDocument } from "../../plugins/dingtalk/src/resources.ts";

test("delivery recovers interrupted work, honors backoff, and excludes concurrent workers", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "usora-delivery-fix-"));
  t.onTestFinished(() => fs.rm(root, { recursive: true, force: true }));
  const event = createUsoraEvent({
    id: "event-1",
    type: "candidate.created",
    producer: { plugin: "foundry" },
    data: {},
  });
  const eventFile = path.join(root, "event.json");
  await fs.writeFile(eventFile, JSON.stringify(event));
  const record = createDeliveryRecord({ provider: "test", subscription: "sub", event });
  const file = path.join(root, "deliveries", encodeURIComponent(record.id) + ".json");
  await writeDeliveryRecord(file, updateDeliveryRecord(record, "delivering"));
  const staleLock = path.join(root, "runtime.lock");
  await fs.mkdir(staleLock);
  await fs.utimes(staleLock, new Date(0), new Date(0));
  let sends = 0;
  const input = {
    stateDir: root,
    eventFiles: [eventFile],
    now: new Date("2026-09-05T00:00:00Z"),
    subscriptions: { subscriptions: [{ id: "sub", provider: "test", event: event.type, message: "test" }] },
    messages: createMessageBuilderRegistry([["test", () => ({ title: "test" })]]),
    providers: createProviderRegistry([
      {
        id: "test",
        capabilities: { messaging: true },
        messaging: {
          sendMessage: () => {
            sends++;
            return { ok: false, error: "offline" };
          },
        },
      },
    ]),
  };
  await runIntegrationRuntime(input);
  assert.equal(sends, 1);
  await runIntegrationRuntime(input);
  assert.equal(sends, 1);
  const retry = await readDeliveryRecord(file);
  assert.ok(retry?.nextAttemptAt);
  await runIntegrationRuntime({ ...input, now: new Date(retry.nextAttemptAt) });
  assert.equal(sends, 2);
  await withIntegrationLock(root, async () => {
    await assert.rejects(runIntegrationRuntime(input), /already being held/);
  });
});

test("failed callback can retry and successful callback cannot apply twice", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "usora-callback-fix-"));
  t.onTestFinished(() => fs.rm(root, { recursive: true, force: true }));
  let attempts = 0;
  const input = {
    stateDir: root,
    callback: { id: "callback", userId: "user", actionId: "candidate.approve", payload: { candidateId: "candidate" } },
    identities: createDingTalkIdentityResolver({ ":user": "reviewer" }),
    authorizer: createDingTalkAuthorizer("maintainer"),
    commands: createCommandRegistry([
      [
        "candidate.approve",
        () => (++attempts === 1 ? { ok: false, error: "temporary" } : { ok: true, data: { done: true } }),
      ],
    ]),
  };
  assert.equal((await dispatchDingTalkCallback(input)).ok, false);
  assert.equal((await dispatchDingTalkCallback(input)).ok, true);
  assert.equal((await dispatchDingTalkCallback(input)).ok, false);
  assert.equal(attempts, 2);
  for (const text of ["candidates", "candidate abc", "governance", "foundry run"]) {
    const cmd = parseDingTalkBotCommand(text)!;
    assert.equal(
      (await input.authorizer.authorize({ actor: { id: "reviewer", kind: "user" }, permission: cmd.name })).allowed,
      true,
    );
  }
});

test("installed MCP responds before stdin closes and serves more than one request", async (t) => {
  const child = spawn(process.execPath, [path.resolve("plugins/dingtalk/dist/mcp.js")], {
    env: { ...process.env, DINGTALK_CONFIG: "" },
    stdio: ["pipe", "pipe", "pipe"],
  });
  t.onTestFinished(() => {
    child.kill();
  });
  let output = "";
  let errors = "";
  child.stderr.on("data", (chunk) => (errors += chunk));
  const responses: any[] = [];
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error(`MCP handshake timeout ${errors}`)), 5000);
    child.on("error", reject);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      let newline;
      while ((newline = output.indexOf("\n")) >= 0) {
        responses.push(JSON.parse(output.slice(0, newline)));
        output = output.slice(newline + 1);
      }
      if (responses.length === 3) {
        clearTimeout(timer);
        resolve();
      }
    });
    for (const request of [
      { id: 1, method: "initialize" },
      { id: 2, method: "tools/list" },
      { id: 3, method: "tools/call", params: { name: "dingtalk_status" } },
    ])
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...request }) + "\n");
  });
  assert.ok(responses[0].result.serverInfo);
  assert.ok(responses[1].result.tools.some((tool: any) => tool.name === "dingtalk_capture_document"));
  assert.equal(JSON.parse(responses[2].result.content[0].text).enabled, false);
});

test("real Foundry MCP receives approved card command and document capture, with durable request dedup", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "usora-live-boundary-"));
  t.onTestFinished(() => fs.rm(root, { recursive: true, force: true }));
  const call = createFoundryClient(path.resolve("plugins/foundry/dist/mcp.js"), {
    ...process.env,
    HOME: root,
    USERPROFILE: root,
    USORA_HOME: path.join(root, "knowledge"),
    PLUGIN_DATA: root,
    CODEBUDDY_PLUGIN_DATA: "",
    CLAUDE_PLUGIN_ROOT: "",
    CODEBUDDY_PLUGIN_ROOT: "",
  });
  await call("hub_init");
  const hub = await call("hub_status");
  const candidate = await call("candidate_create", {
    title: "Review card",
    summary: "A real integration review",
    evidence: [],
  });
  const commands = createFoundryCommands(call);
  const command = {
    id: "stable-request",
    name: "candidate.approve",
    actor: { id: "reviewer", kind: "user" as const },
    args: { id: candidate.id },
    source: { provider: "dingtalk" },
    issuedAt: new Date().toISOString(),
  };
  assert.equal((await commands.get("candidate.approve")!(command)).ok, true);
  assert.equal((await call("candidate_get", { id: candidate.id })).state, "EVALUATED");
  assert.equal((await commands.get("candidate.approve")!(command)).ok, true);
  const events = await call("event_list", { limit: 100 });
  assert.equal(events.events.filter((event: any) => event.type === "candidate.approved").length, 1);
  const approved = events.events.find((event: any) => event.type === "candidate.approved");
  await fs.unlink(path.join(hub.knowledge_path, "events", approved.file));
  assert.equal((await commands.get("candidate.approve")!(command)).ok, true);
  const recovered = await call("event_list", { limit: 100 });
  assert.equal(recovered.events.filter((event: any) => event.type === "candidate.approved").length, 1);
  await commands.get("candidate.reject")!({ ...command, id: "newer-request", name: "candidate.reject" });
  await commands.get("candidate.approve")!(command);
  assert.equal((await call("candidate_get", { id: candidate.id })).state, "REJECTED");
  await call("skill_create", { name: "review-skill", description: "Review governance", content: "# Review" });
  const governance = {
    ...command,
    id: "retire-request",
    name: "governance.resolve",
    args: { skill: "review-skill", action: "RETIRE" },
  };
  assert.equal((await commands.get("governance.resolve")!(governance)).ok, false);
  const owner = { ...governance, actor: { id: hub.config.maintainer, kind: "user" as const } };
  assert.equal((await commands.get("governance.resolve")!(owner)).ok, true);
  assert.equal((await commands.get("governance.resolve")!(owner)).ok, true);
  assert.equal(
    (await call("event_list", { limit: 100 })).events.filter((event: any) => event.type === "governance.resolved")
      .length,
    1,
  );
  const app = {
    getAccessToken: async () => ({ ok: true as const, data: { accessToken: "test", expiresAt: 1 } }),
    request: async (url: string, init?: any) => {
      assert.ok(url.includes("/documents/doc-key/blocks?operatorId=union-id"));
      assert.equal(init.method, "GET");
      return {
        ok: true as const,
        data: { success: true, result: { data: [{ type: "paragraph", text: "Real API response fixture" }] } },
      };
    },
  };
  const resource = await fetchDingTalkDocument(app, "doc-key", "union-id");
  const activity = await call("activity_capture", {
    source: "dingtalk",
    session_id: "doc-key",
    task: "Capture document",
    result: resource.content,
    metadata: { resource },
  });
  assert.ok(activity.id);
  const index = await commands.get("foundry.run")!({ ...command, id: "index", name: "foundry.run", args: {} });
  assert.equal(index.ok, true);
  assert.ok(hub.knowledge_path);
});

test("interactive card persists offered actions and Stream callback uses the saved target", async (t) => {
  vi.stubEnv("USORA_TEST_WEBHOOK", "https://oapi.dingtalk.com/robot/send?access_token=test");
  t.onTestFinished(() => vi.unstubAllEnvs());
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "usora-card-actions-"));
  t.onTestFinished(() => fs.rm(root, { recursive: true, force: true }));
  const stateDir = path.join(root, "integrations", "dingtalk");
  const event = createUsoraEvent({
    type: "candidate.created",
    producer: { plugin: "foundry" },
    data: { id: "candidate-real", title: "Real card" },
  });
  const message = { ...createCandidateCreatedMessage(event), id: "a".repeat(64) };
  let request: any;
  const app = {
    getAccessToken: async () => ({ ok: true as const, data: { accessToken: "test", expiresAt: 1 } }),
    request: async (_url: string, init?: any) => {
      request = init.body;
      return { ok: true as const, data: { success: true } };
    },
  };
  await createDingTalkCardTransport(app, {
    templateId: "template",
    conversationId: "group",
    robotCode: "robot",
    stateDir,
  }).sendMessage(message);
  assert.equal(request.callbackType, "STREAM");
  assert.equal(request.outTrackId, message.id);
  assert.ok(JSON.parse(request.cardData.cardParamMap.actions).some((action: any) => action.id === "candidate.approve"));
  assert.ok(await fs.readFile(cardFile(stateDir, message.id), "utf8"));
  let called: any;
  const service = await createDingTalkService(
    {
      enabled: true,
      transport: "webhook",
      corpId: "corp",
      identities: { "corp:user": "reviewer" },
      env: { webhookUrl: "USORA_TEST_WEBHOOK" },
    },
    async (name, args) =>
      name === "hub_status"
        ? { hub: root, knowledge_path: root, config: { maintainer: "maintainer" } }
        : (called = { name, args }),
  );
  const body = JSON.stringify({
    corpId: "corp",
    userId: "user",
    outTrackId: message.id,
    content: JSON.stringify({
      cardPrivateData: { actionIds: ["candidate.approve"], params: { candidateId: "forged" } },
    }),
  });
  assert.equal((await service.handleCard("card-click", body)).ok, true);
  assert.equal(called.args.id, "candidate-real");
  assert.equal(called.args.reviewer, "reviewer");
  await assert.rejects(service.handleCard("other", body.replace('"corp"', '"wrong"')), /tenant/);
});
