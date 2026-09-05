import fs from "node:fs/promises";
import path from "node:path";
import { fromLegacyFoundryEvent, isUsoraEvent, type UsoraEvent } from "@usora/integration";
import { knowledgeDirPath, now, readJson, writeEvent } from "./storage.ts";

export const STAGE_BUDGETS = {
  pattern_judge: { required: 1200, recommended: 1200, optional: 600 },
  candidate_resolver: { required: 1600, recommended: 1600, optional: 800 },
  skill_compiler: { required: 2400, recommended: 1800, optional: 1200 },
  evaluator: { required: 1000, recommended: 800, optional: 400 },
};

type BudgetPart = "required" | "recommended" | "optional";
type BudgetStage = keyof typeof STAGE_BUDGETS;
type BudgetParts = Partial<Record<BudgetPart, unknown>>;
type ContextBudgetArgs = BudgetParts & {
  stage?: BudgetStage;
};
type IntelligenceRunArgs = {
  stage?: string;
  started_at?: string;
  duration_ms?: unknown;
  input?: unknown;
  output?: unknown;
  input_chars?: number;
  output_chars?: number;
  evidence_loaded?: unknown;
  skills_loaded?: unknown;
  full_activity_load?: unknown;
  full_skill_load?: unknown;
  cache_hit?: unknown;
  budget?: unknown;
};
type StoredEvent = UsoraEvent<Record<string, unknown> | null>;
type PatternRecord = {
  candidate_id?: unknown;
};

const BUDGET_PARTS: BudgetPart[] = ["required", "recommended", "optional"];

function jsonChars(value: unknown): number {
  return JSON.stringify(value ?? null).length;
}

function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function average(values: number[]): number {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function partReport(stage: BudgetStage, parts: BudgetParts = {}) {
  const budget = STAGE_BUDGETS[stage] || STAGE_BUDGETS.candidate_resolver;
  const entries = Object.fromEntries(
    BUDGET_PARTS.map((kind) => {
      const chars = jsonChars(parts[kind] || {});
      return [kind, { chars, budget_chars: budget[kind], overflow: chars > budget[kind] }];
    }),
  ) as Record<BudgetPart, { chars: number; budget_chars: number; overflow: boolean }>;
  const total_chars = entries.required.chars + entries.recommended.chars + entries.optional.chars;
  const budget_chars = budget.required + budget.recommended + budget.optional;
  return {
    stage,
    ...entries,
    total_chars,
    budget_chars,
    estimated_tokens: estimateTokens(total_chars),
    overflow: total_chars > budget_chars || Object.values(entries).some((entry) => entry.overflow),
  };
}

export async function checkContextBudget(stage: BudgetStage, parts: BudgetParts = {}) {
  const report = partReport(stage, parts);
  if (report.overflow) await writeEvent("ContextBudgetOverflow", report);
  return report;
}

export async function recordIntelligenceRun(args: IntelligenceRunArgs = {}) {
  const input_chars = args.input_chars ?? jsonChars(args.input);
  const output_chars = args.output_chars ?? jsonChars(args.output);
  const event = {
    stage: args.stage || "unknown",
    started_at: args.started_at || now(),
    duration_ms: Number(args.duration_ms) || 0,
    input_chars,
    output_chars,
    estimated_input_tokens: estimateTokens(input_chars),
    estimated_output_tokens: estimateTokens(output_chars),
    evidence_loaded: Number(args.evidence_loaded) || 0,
    skills_loaded: Number(args.skills_loaded) || 0,
    full_activity_load: Boolean(args.full_activity_load),
    full_skill_load: Boolean(args.full_skill_load),
    cache_hit: Boolean(args.cache_hit),
    budget: args.budget || null,
  };
  await writeEvent("IntelligenceRun", event);
  return event;
}

export async function handleContextBudget(args: ContextBudgetArgs = {}) {
  return checkContextBudget(args.stage || "candidate_resolver", {
    required: args.required || {},
    recommended: args.recommended || {},
    optional: args.optional || {},
  });
}

async function readEvents(): Promise<StoredEvent[]> {
  const eventsDir = await knowledgeDirPath("events");
  const items: StoredEvent[] = [];
  for (const file of await fs.readdir(eventsDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(eventsDir, file));
    if (!isRecord(item)) continue;
    items.push(isUsoraEvent(item) ? (item as StoredEvent) : fromLegacyFoundryEvent(item, { plugin: "foundry" }));
  }
  return items;
}

export async function handleTelemetryMetrics() {
  const events = await readEvents();
  const runs = events.filter((event) => event.type === "intelligence.run").map((event) => event.data || {});
  const resolved = events.filter((event) => event.type === "candidate.resolved").map((event) => event.data || {});
  const rawPatternIndex = await readJson(path.join(await knowledgeDirPath("indexes"), "patterns.json")).catch(
    () => null,
  );
  const patternIndex = isRecord(rawPatternIndex) ? (rawPatternIndex as { patterns?: unknown }) : {};
  const patterns = Array.isArray(patternIndex.patterns) ? (patternIndex.patterns as PatternRecord[]) : [];
  return {
    runs: runs.length,
    candidate_merge_rate: resolved.length
      ? resolved.filter((event) => event.action === "matched" || event.merge_target).length / resolved.length
      : 0,
    candidate_drop_rate: resolved.length
      ? resolved.filter((event) => event.action === "dropped").length / resolved.length
      : 0,
    activity_full_load_avoided: runs.filter((run) => run.full_activity_load === false).length,
    skill_full_load_avoided: runs.filter((run) => run.full_skill_load === false).length,
    avg_context_chars: average(runs.map((run) => numberValue(run.input_chars))),
    avg_evidence_loaded: average(runs.map((run) => numberValue(run.evidence_loaded))),
    pattern_reuse_rate: patterns.length
      ? patterns.filter((pattern) => pattern.candidate_id).length / patterns.length
      : 0,
    note: "Token counts are chars/4 estimates only; no absolute token savings are claimed.",
  };
}
