import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  createMessageBuilderRegistry,
  createProviderRegistry,
  dispatchIntegrationCommand,
  runIntegrationRuntime,
  replayDeadLetter,
  readDeliveryRecord,
  writeDeliveryRecord,
  withIntegrationLock,
  type IntegrationMessage,
  type IntegrationCommand,
  type IntegrationSubscription,
} from "@usora/integration";
import { createFoundryClient, createFoundryCommands, type FoundryCall } from "./foundry.ts";
import { resolveDingTalkConfig, type DingTalkConfigInput } from "./config.ts";
import { createDingTalkAppClient } from "./app.ts";
import { createDingTalkCardTransport, cardFile } from "./cards.ts";
import { createDingTalkWebhookTransport } from "./webhook.ts";
import { createDingTalkProvider } from "./provider.ts";
import { createDingTalkIdentityResolver } from "./identity.ts";
import { createDingTalkAuthorizer } from "./authorization.ts";
import { dispatchDingTalkCallback } from "./dispatch.ts";
import { parseDingTalkStreamCallback } from "./callback.ts";
import { parseDingTalkInboundMessage } from "./inbound.ts";
import { parseDingTalkBotCommand } from "./parser.ts";
import { createDingTalkBotResponse } from "./responses.ts";
import { fetchDingTalkDocument } from "./resources.ts";
import { normalizeDingTalkResourceActivity } from "./source.ts";
import {
  createCandidateCreatedMessage,
  createSkillPublishedMessage,
  createGovernanceMessage,
  createFoundryDigestMessage,
} from "./builders.ts";

export type DingTalkServiceConfig = DingTalkConfigInput & {
  foundryMcp?: string;
  foundryEnv?: Record<string, string>;
  stream?: boolean;
  corpId?: string;
  identities?: Record<string, string>;
  templateId?: string;
  conversationId?: string;
};

export async function createDingTalkService(input: DingTalkServiceConfig, call?: FoundryCall) {
  const config = resolveDingTalkConfig(input);
  if (!config.enabled) throw Error("DingTalk integration is disabled");
  if (
    !call &&
    (process.env.PLUGIN_DATA || process.env.CODEBUDDY_PLUGIN_DATA) &&
    !input.foundryEnv?.PLUGIN_DATA &&
    !input.foundryEnv?.CODEBUDDY_PLUGIN_DATA
  )
    throw Error(
      "Configure foundryEnv with Foundry's data directory; DingTalk's plugin data cannot be reused implicitly",
    );
  const foundry =
    call ??
    createFoundryClient(input.foundryMcp || process.env.USORA_FOUNDRY_MCP || "", {
      ...process.env,
      PLUGIN_DATA: "",
      CODEBUDDY_PLUGIN_DATA: "",
      ...input.foundryEnv,
    });
  const hub = await foundry("hub_status");
  if (hub.migration_required) throw Error("Migrate Foundry before enabling integration");
  if (
    typeof hub.hub !== "string" ||
    typeof hub.knowledge_path !== "string" ||
    typeof hub.config?.maintainer !== "string"
  )
    throw Error("Invalid Foundry hub status");
  const stateDir = path.join(hub.hub, "integrations", "dingtalk");
  const eventDir = path.join(hub.knowledge_path, "events");
  const app = createDingTalkAppClient({
    appKey: config.secrets.appKey || "",
    appSecret: config.secrets.appSecret || "",
  });
  if (
    (input.stream || config.transport === "app") &&
    (!config.secrets.appKey || !config.secrets.appSecret || !input.corpId)
  )
    throw Error("Stream/app requires app credentials and corpId");
  if (config.transport === "app" && (!input.stream || !input.templateId || !input.conversationId))
    throw Error("Interactive app messaging requires stream, templateId and conversationId");
  const identities = createDingTalkIdentityResolver(input.identities || {});
  const commands = createFoundryCommands(foundry);
  // Read the authoritative Maintainer again for each operation, so config changes take effect immediately.
  const authorizer = {
    async authorize(context: Parameters<ReturnType<typeof createDingTalkAuthorizer>["authorize"]>[0]) {
      const current = await foundry("hub_status");
      if (typeof current.config?.maintainer !== "string") return { allowed: false, reason: "Maintainer unavailable" };
      return createDingTalkAuthorizer(current.config.maintainer).authorize(context);
    },
  };
  const messaging =
    config.transport === "app"
      ? createDingTalkCardTransport(app, {
          templateId: input.templateId!,
          conversationId: input.conversationId!,
          robotCode: config.secrets.appKey!,
          stateDir,
        })
      : createDingTalkWebhookTransport({
          url: config.secrets.webhookUrl!,
          ...(config.secrets.webhookSecret ? { secret: config.secrets.webhookSecret } : {}),
        });
  const defaults: IntegrationSubscription[] = [
    ["candidate.created", "candidate"],
    ["skill.published", "skill"],
    ["governance.resolved", "governance"],
    ["governance.finding", "governance"],
    ["foundry.completed", "digest"],
  ].map(([event, message]) => ({ id: event!, event: event!, provider: "dingtalk", message: message! }));
  const messages = createMessageBuilderRegistry([
    [
      "candidate",
      (event) => createCandidateCreatedMessage(event as Parameters<typeof createCandidateCreatedMessage>[0]),
    ],
    ["skill", (event) => createSkillPublishedMessage(event as Parameters<typeof createSkillPublishedMessage>[0])],
    ["governance", (event) => createGovernanceMessage(event as Parameters<typeof createGovernanceMessage>[0])],
    ["digest", (event) => createFoundryDigestMessage(event as Parameters<typeof createFoundryDigestMessage>[0])],
  ]);
  return {
    config,
    stateDir,
    async sync() {
      const eventFiles = (await fs.readdir(eventDir))
        .filter((file) => file.endsWith(".json"))
        .map((file) => path.join(eventDir, file));
      return runIntegrationRuntime({
        eventFiles,
        stateDir,
        messages,
        subscriptions: { subscriptions: input.subscriptions ?? defaults },
        providers: createProviderRegistry([createDingTalkProvider(messaging)]),
      });
    },
    async replay(id: string) {
      return withIntegrationLock(stateDir, async () => {
        const file = path.join(stateDir, "deliveries", `${encodeURIComponent(id)}.json`);
        const record = await readDeliveryRecord(file);
        if (!record || record.status !== "dead-letter") throw Error("Dead letter not found");
        await writeDeliveryRecord(file, replayDeadLetter(record));
        return { replayed: id };
      });
    },
    async captureDocument(docKey: string, operatorId: string) {
      if (!input.corpId) throw Error("Document capture requires corpId for provenance and deduplication");
      if (!config.secrets.appKey || !config.secrets.appSecret) throw Error("Document capture requires app credentials");
      const resource = await fetchDingTalkDocument(app, docKey, operatorId);
      const activity = normalizeDingTalkResourceActivity(
        { ...resource, ...(input.corpId ? { corpId: input.corpId } : {}) },
        operatorId,
      );
      const session_id = `dingtalk-document-${createHash("sha256").update(`${input.corpId}:${docKey}`).digest("hex")}`;
      return foundry("activity_capture", { ...activity, session_id });
    },
    async handleCard(messageId: string, body: string) {
      const parsed = parseDingTalkStreamCallback(messageId, body);
      if (!parsed.ok) throw Error(parsed.error);
      const callback = parsed.callback;
      if (!input.corpId || callback.corpId !== input.corpId) throw Error("Wrong callback tenant");
      const saved = JSON.parse(
        await fs.readFile(cardFile(stateDir, String(callback.payload.outTrackId)), "utf8"),
      ) as IntegrationMessage;
      const action = saved.actions?.find((action) => action.id === callback.actionId);
      if (!action) throw Error("Action was not offered by this card");
      callback.payload = action.metadata || {};
      return dispatchDingTalkCallback({ callback, stateDir, identities, authorizer, commands });
    },
    async handleBot(body: string) {
      const payload = JSON.parse(body);
      const message = parseDingTalkInboundMessage(payload);
      if (!input.corpId || message.actor.externalTenantId !== input.corpId) throw Error("Wrong message tenant");
      const actor = await identities.resolveIdentity(message.actor);
      if (!actor) throw Error("Unmapped DingTalk user");
      const parsed = parseDingTalkBotCommand(message.text);
      if (!parsed) throw Error("Unknown command");
      const command: IntegrationCommand = {
        ...parsed,
        id: message.id,
        actor,
        source: { provider: "dingtalk" },
        issuedAt: new Date().toISOString(),
      };
      const result = await dispatchIntegrationCommand(commands, command, authorizer);
      const url = new URL(payload.sessionWebhook);
      if (url.protocol !== "https:" || url.hostname !== "oapi.dingtalk.com" || url.pathname !== "/robot/send")
        throw Error("Invalid reply webhook");
      const sent = await createDingTalkWebhookTransport({ url: url.href }).sendMessage(
        createDingTalkBotResponse(command, result),
      );
      if (!sent.ok) throw Error(sent.error);
      return result;
    },
  };
}
