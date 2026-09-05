import { randomUUID } from "node:crypto";
import path from "node:path";
import type { UsoraActor } from "./identity.ts";

export const USORA_EVENT_SCHEMA_VERSION = 1;

export const USORA_EVENT_TYPES = [
  "activity.created",
  "activity.updated",
  "activity.processed",
  "pattern.detected",
  "pattern.index.updated",
  "candidate.created",
  "candidate.updated",
  "candidate.resolved",
  "candidate.approved",
  "candidate.rejected",
  "candidate.archived",
  "skill.created",
  "skill.draft.created",
  "skill.updated",
  "skill.evolved",
  "skill.evolution.recommended",
  "skill.evaluation.completed",
  "skill.published",
  "skill.deprecated",
  "skill.retired",
  "governance.finding",
  "governance.resolved",
  "usage.captured",
  "foundry.started",
  "foundry.completed",
  "foundry.failed",
  "intelligence.run",
  "context.budget.overflow",
  "hub.initialized",
  "hub.migrated",
  "hub.migration.failed",
] as const;

export type UsoraEventType = (typeof USORA_EVENT_TYPES)[number] | (string & {});

export const LEGACY_FOUNDRY_EVENT_TYPE_MAP: Record<string, UsoraEventType> = {
  ActivityCreated: "activity.created",
  ActivityUpdated: "activity.updated",
  CandidateCreated: "candidate.created",
  CandidateResolved: "candidate.resolved",
  ReviewSubmitted: "candidate.updated",
  SkillDraftCreated: "skill.draft.created",
  SkillEvolved: "skill.evolved",
  SkillEvolutionRecommended: "skill.evolution.recommended",
  SkillEvaluationCompleted: "skill.evaluation.completed",
  SkillPublished: "skill.published",
  GovernanceResolved: "governance.resolved",
  UsageCaptured: "usage.captured",
  PatternIndexUpdated: "pattern.index.updated",
  IntelligenceRun: "intelligence.run",
  ContextBudgetOverflow: "context.budget.overflow",
  HubMigrated: "hub.migrated",
  HubMigrationFailed: "hub.migration.failed",
};

export type UsoraEventSubject = {
  type: string;
  id: string;
};

export type UsoraEventProducer = {
  plugin: string;
  version?: string;
};

export type UsoraEvent<TData = unknown> = {
  id: string;
  schemaVersion: number;
  type: UsoraEventType;
  occurredAt: string;
  producer: UsoraEventProducer;
  actor?: UsoraActor;
  subject?: UsoraEventSubject;
  data: TData;
  metadata?: Record<string, unknown>;
};

export type CreateUsoraEventInput<TData> = Omit<UsoraEvent<TData>, "id" | "schemaVersion" | "occurredAt"> &
  Partial<Pick<UsoraEvent<TData>, "id" | "schemaVersion" | "occurredAt">>;

export type LegacyFoundryEvent<TData = unknown> = {
  id?: unknown;
  schema_version?: unknown;
  type?: unknown;
  timestamp?: unknown;
  data?: TData;
  file?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function legacyEventId(input: LegacyFoundryEvent): string {
  const id = stringValue(input.id);
  if (id) return id;
  const file = stringValue(input.file);
  if (file) return path.basename(file, ".json");
  return `event-${randomUUID()}`;
}

export function createUsoraEvent<TData>(input: CreateUsoraEventInput<TData>): UsoraEvent<TData> {
  return {
    id: input.id ?? `event-${randomUUID()}`,
    schemaVersion: input.schemaVersion ?? USORA_EVENT_SCHEMA_VERSION,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    type: input.type,
    producer: input.producer,
    data: input.data,
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export function normalizeEventType(type: string): UsoraEventType {
  return LEGACY_FOUNDRY_EVENT_TYPE_MAP[type] ?? type;
}

export function fromLegacyFoundryEvent<TData = unknown>(
  input: LegacyFoundryEvent<TData>,
  producer: UsoraEventProducer = { plugin: "foundry" },
): UsoraEvent<TData | null> {
  return createUsoraEvent({
    id: legacyEventId(input),
    schemaVersion: Number(input.schema_version) || USORA_EVENT_SCHEMA_VERSION,
    type: normalizeEventType(stringValue(input.type) ?? "unknown"),
    occurredAt: stringValue(input.timestamp) ?? new Date(0).toISOString(),
    producer,
    data: input.data ?? null,
    metadata: { legacyType: input.type ?? null, legacySchemaVersion: input.schema_version ?? null },
  });
}

export function isUsoraEvent(value: unknown): value is UsoraEvent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.schemaVersion === "number" &&
    typeof value.type === "string" &&
    typeof value.occurredAt === "string" &&
    isRecord(value.producer) &&
    typeof value.producer.plugin === "string" &&
    "data" in value
  );
}

export function validateUsoraEvent(value: unknown): UsoraEvent {
  if (!isUsoraEvent(value)) throw Error("invalid UsoraEvent");
  return value;
}
