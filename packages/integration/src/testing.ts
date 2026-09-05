import fs from "node:fs/promises";
import path from "node:path";
import { type CreateUsoraEventInput, createUsoraEvent } from "./events.ts";
import type { UsoraActor } from "./identity.ts";
import type { IntegrationAction, IntegrationMessage } from "./messages.ts";
import { type IntegrationProvider, createProviderRegistry } from "./providers.ts";
import type { IntegrationResource } from "./resources.ts";
import { runIntegrationRuntime, type IntegrationRuntimeResult } from "./runtime.ts";
import { createMessageBuilderRegistry, type IntegrationSubscriptionConfig } from "./subscriptions.ts";

export type IntegrationHarnessInput = {
  stateDir: string;
  provider?: IntegrationProvider;
  subscriptions?: IntegrationSubscriptionConfig;
};

export function createMockIntegrationProvider(id = "test") {
  const sentMessages: IntegrationMessage[] = [];
  const provider = {
    id,
    capabilities: { messaging: true },
    messaging: {
      sendMessage(message) {
        sentMessages.push(message);
        return { ok: true, data: { delivered: true } };
      },
    },
  } satisfies IntegrationProvider;

  return { provider, sentMessages };
}

export function mockIntegrationIdentity(input: Partial<UsoraActor> = {}): UsoraActor {
  return { id: "test-user", kind: "user", ...input };
}

export function mockIntegrationResource(input: Partial<IntegrationResource> = {}): IntegrationResource {
  return { provider: "test", type: "document", externalId: "resource-1", title: "Test Resource", ...input };
}

export function mockIntegrationAction(input: Partial<IntegrationAction> = {}): IntegrationAction {
  return { id: "test.action", label: "Test Action", command: "test.command", ...input };
}

export function mockIntegrationEvent(input: Partial<CreateUsoraEventInput<Record<string, unknown>>> = {}) {
  return createUsoraEvent({
    type: "test.event",
    producer: { plugin: "test" },
    data: { title: "Test Event" },
    ...input,
  });
}

export function createIntegrationHarness(input: IntegrationHarnessInput) {
  const mock = createMockIntegrationProvider();
  const provider = input.provider || mock.provider;
  const subscriptions = input.subscriptions || {
    subscriptions: [{ id: "test", event: "test.event", provider: provider.id, message: "test" }],
  };
  const messages = createMessageBuilderRegistry([
    [
      "test",
      (event) => ({
        title:
          typeof event.data === "object" && event.data && "title" in event.data
            ? String(event.data.title)
            : "Test Event",
      }),
    ],
  ]);

  return {
    provider,
    providers: createProviderRegistry([provider]),
    subscriptions,
    messages,
    sentMessages: mock.sentMessages,
    async runEvent(event = mockIntegrationEvent()): Promise<IntegrationRuntimeResult> {
      const eventDir = path.join(input.stateDir, "events");
      await fs.mkdir(eventDir, { recursive: true });
      const eventFile = path.join(eventDir, `${encodeURIComponent(event.id)}.json`);
      await fs.writeFile(eventFile, `${JSON.stringify(event)}\n`, "utf8");
      return runIntegrationRuntime({
        eventFiles: [eventFile],
        subscriptions,
        messages,
        providers: createProviderRegistry([provider]),
        stateDir: input.stateDir,
      });
    },
  };
}
