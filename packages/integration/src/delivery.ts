import fs from "node:fs/promises";
import path from "node:path";
import type { UsoraEvent } from "./events.ts";
import type { IntegrationMessage } from "./messages.ts";

export const DELIVERY_STATUSES = ["pending", "delivering", "delivered", "failed", "dead-letter"] as const;
export const BLOCKING_DELIVERY_STATUSES = ["delivered", "dead-letter"] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
export type BlockingDeliveryStatus = (typeof BLOCKING_DELIVERY_STATUSES)[number];

export type DeliveryRecord = {
  id: string;
  provider: string;
  subscription: string;
  eventId: string;
  status: DeliveryStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  message?: IntegrationMessage;
  error?: string;
  nextAttemptAt?: string;
};

export type RetryConfig = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
};

export type IntegrationCheckpoint = {
  provider: string;
  subscription: string;
  eventId: string;
  occurredAt: string;
  updatedAt: string;
};

export type DeadLetterDiagnostic = Pick<
  DeliveryRecord,
  "id" | "provider" | "subscription" | "eventId" | "attempts" | "error" | "updatedAt"
>;

export function deliveryDedupKey(provider: string, subscription: string, event: UsoraEvent): string {
  return `${provider}:${subscription}:${event.id}`;
}

export function shouldStartDelivery(record: DeliveryRecord | null | undefined, now = new Date()): boolean {
  return (
    !record ||
    (!BLOCKING_DELIVERY_STATUSES.includes(record.status as BlockingDeliveryStatus) &&
      (!record.nextAttemptAt || Date.parse(record.nextAttemptAt) <= now.getTime()))
  );
}

export function isRetryableDeliveryError(error: unknown): boolean {
  if (error && typeof error === "object" && "retryable" in error) return Boolean(error.retryable);
  return true;
}

export function retryDelayMs(attempts: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  return Math.min(config.baseDelayMs * 2 ** Math.max(0, attempts - 1), config.maxDelayMs);
}

export function scheduleRetry(
  record: DeliveryRecord,
  error: unknown,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  now = new Date(),
): DeliveryRecord {
  const message = error instanceof Error ? error.message : String(error || "delivery failed");
  if (!isRetryableDeliveryError(error) || record.attempts >= config.maxAttempts) {
    return updateDeliveryRecord(record, "dead-letter", { error: message }, now.toISOString());
  }
  return updateDeliveryRecord(
    record,
    "failed",
    {
      error: message,
      nextAttemptAt: new Date(now.getTime() + retryDelayMs(record.attempts, config)).toISOString(),
    },
    now.toISOString(),
  );
}

export function createDeliveryRecord(args: {
  provider: string;
  subscription: string;
  event: UsoraEvent;
  message?: IntegrationMessage;
  now?: string;
}): DeliveryRecord {
  const now = args.now ?? new Date().toISOString();
  return {
    id: deliveryDedupKey(args.provider, args.subscription, args.event),
    provider: args.provider,
    subscription: args.subscription,
    eventId: args.event.id,
    status: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    ...(args.message ? { message: args.message } : {}),
  };
}

export function updateDeliveryRecord(
  record: DeliveryRecord,
  status: DeliveryStatus,
  patch: Partial<Pick<DeliveryRecord, "error" | "nextAttemptAt">> = {},
  now = new Date().toISOString(),
): DeliveryRecord {
  return {
    ...record,
    status,
    attempts: status === "delivering" ? record.attempts + 1 : record.attempts,
    updatedAt: now,
    ...patch,
  };
}

export function advanceCheckpoint(
  checkpoint: IntegrationCheckpoint | null,
  event: UsoraEvent,
  delivery: DeliveryRecord,
  now = new Date().toISOString(),
): IntegrationCheckpoint | null {
  if (delivery.status !== "delivered") return checkpoint;
  if (checkpoint && checkpoint.occurredAt >= event.occurredAt) return checkpoint;
  return {
    provider: delivery.provider,
    subscription: delivery.subscription,
    eventId: event.id,
    occurredAt: event.occurredAt,
    updatedAt: now,
  };
}

export async function readCheckpoint(file: string): Promise<IntegrationCheckpoint | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as IntegrationCheckpoint;
  } catch {
    return null;
  }
}

export async function writeCheckpoint(file: string, checkpoint: IntegrationCheckpoint): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

export async function readDeliveryRecord(file: string): Promise<DeliveryRecord | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as DeliveryRecord;
  } catch {
    return null;
  }
}

export async function writeDeliveryRecord(file: string, record: DeliveryRecord): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

export async function readDeadLetter(file: string): Promise<DeliveryRecord | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as DeliveryRecord;
  } catch {
    return null;
  }
}

export async function writeDeadLetter(file: string, record: DeliveryRecord): Promise<void> {
  if (record.status !== "dead-letter") throw new Error("dead letter record must have dead-letter status");
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

export function deadLetterDiagnostic(record: DeliveryRecord): DeadLetterDiagnostic {
  return {
    id: record.id,
    provider: record.provider,
    subscription: record.subscription,
    eventId: record.eventId,
    attempts: record.attempts,
    ...(record.error ? { error: record.error } : {}),
    updatedAt: record.updatedAt,
  };
}

export function replayDeadLetter(record: DeliveryRecord, now = new Date().toISOString()): DeliveryRecord {
  const { error: _error, nextAttemptAt: _nextAttemptAt, ...rest } = record;
  return { ...rest, status: "pending", attempts: 0, updatedAt: now };
}
