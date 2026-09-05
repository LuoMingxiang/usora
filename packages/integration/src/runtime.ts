import fs from "node:fs/promises";
import path from "node:path";
import type { RetryConfig } from "./delivery.ts";
import {
  advanceCheckpoint,
  createDeliveryRecord,
  deadLetterDiagnostic,
  readCheckpoint,
  readDeliveryRecord,
  scheduleRetry,
  shouldStartDelivery,
  updateDeliveryRecord,
  writeCheckpoint,
  writeDeadLetter,
  writeDeliveryRecord,
  type DeadLetterDiagnostic,
} from "./delivery.ts";
import { fromLegacyFoundryEvent, isUsoraEvent, validateUsoraEvent, type UsoraEvent } from "./events.ts";
import type { ProviderRegistry } from "./providers.ts";
import {
  buildSubscriptionMessage,
  matchSubscriptions,
  type IntegrationSubscriptionConfig,
  type MessageBuilderRegistry,
} from "./subscriptions.ts";

export type IntegrationRuntimeInput = {
  eventFiles: string[];
  subscriptions: IntegrationSubscriptionConfig;
  messages: MessageBuilderRegistry;
  providers: ProviderRegistry;
  stateDir: string;
  retry?: RetryConfig;
  now?: Date;
};

export type IntegrationRuntimeResult = {
  events: number;
  delivered: number;
  skipped: number;
  failed: number;
  deadLettered: number;
  diagnostics: DeadLetterDiagnostic[];
};

function stateFile(root: string, kind: "checkpoints" | "dead-letter" | "deliveries", id: string): string {
  return path.join(root, kind, `${encodeURIComponent(id)}.json`);
}

export async function readUsoraEventFile(file: string): Promise<UsoraEvent> {
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as unknown;
  return isUsoraEvent(raw) ? validateUsoraEvent(raw) : fromLegacyFoundryEvent({ ...(raw as object), file });
}

export async function readUsoraEventFiles(files: string[]): Promise<UsoraEvent[]> {
  const events = await Promise.all(files.map(readUsoraEventFile));
  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

export async function runIntegrationRuntime(input: IntegrationRuntimeInput): Promise<IntegrationRuntimeResult> {
  const now = input.now ?? new Date();
  const result: IntegrationRuntimeResult = {
    events: 0,
    delivered: 0,
    skipped: 0,
    failed: 0,
    deadLettered: 0,
    diagnostics: [],
  };

  for (const event of await readUsoraEventFiles(input.eventFiles)) {
    result.events += 1;
    for (const match of matchSubscriptions(event, input.subscriptions)) {
      const message = buildSubscriptionMessage(match, input.messages);
      const provider = input.providers.get(match.subscription.provider);
      const pending = createDeliveryRecord({
        provider: match.subscription.provider,
        subscription: match.subscription.id,
        event,
        message,
        now: now.toISOString(),
      });
      const deliveryFile = stateFile(input.stateDir, "deliveries", pending.id);
      const record = (await readDeliveryRecord(deliveryFile)) ?? pending;

      if (!shouldStartDelivery(record)) {
        if (record.status === "delivered") {
          const checkpoint = advanceCheckpoint(
            await readCheckpoint(stateFile(input.stateDir, "checkpoints", `${record.provider}:${record.subscription}`)),
            event,
            record,
            now.toISOString(),
          );
          if (checkpoint) {
            await writeCheckpoint(
              stateFile(input.stateDir, "checkpoints", `${record.provider}:${record.subscription}`),
              checkpoint,
            );
          }
        }
        result.skipped += 1;
        continue;
      }

      const delivering = updateDeliveryRecord({ ...record, message }, "delivering", {}, now.toISOString());
      await writeDeliveryRecord(deliveryFile, delivering);

      try {
        if (!provider?.messaging) throw Error(`Provider ${match.subscription.provider} cannot send messages`);
        const sent = await provider.messaging.sendMessage(message);
        if (!sent.ok) throw Error(sent.error);
        const delivered = updateDeliveryRecord(delivering, "delivered", {}, now.toISOString());
        await writeDeliveryRecord(deliveryFile, delivered);
        const checkpoint = advanceCheckpoint(
          await readCheckpoint(
            stateFile(input.stateDir, "checkpoints", `${delivered.provider}:${delivered.subscription}`),
          ),
          event,
          delivered,
          now.toISOString(),
        );
        if (checkpoint) {
          await writeCheckpoint(
            stateFile(input.stateDir, "checkpoints", `${delivered.provider}:${delivered.subscription}`),
            checkpoint,
          );
        }
        result.delivered += 1;
      } catch (error) {
        const failed = scheduleRetry(delivering, error, input.retry, now);
        await writeDeliveryRecord(deliveryFile, failed);
        if (failed.status === "dead-letter") {
          await writeDeadLetter(stateFile(input.stateDir, "dead-letter", failed.id), failed);
          result.deadLettered += 1;
          result.diagnostics.push(deadLetterDiagnostic(failed));
        } else {
          result.failed += 1;
        }
      }
    }
  }

  return result;
}
