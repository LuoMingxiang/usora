import fs from "node:fs/promises";
import path from "node:path";
import { checkContextBudget, recordIntelligenceRun } from "./context-budget.ts";
import { withKnowledgeLock } from "./lock.ts";
import { PATTERN_SCHEMA_VERSION, knowledgeDirPath, loadConfig, readJson, writeEvent, writeJson } from "./storage.ts";
import { listLimit } from "./validation.ts";
import type { ActivitySourceRecord } from "../sources/activity-source.ts";
import { discoverActivitySources } from "../sources/registry.ts";
import { loadIngestionState, saveIngestionState } from "../sources/ingestion-state.ts";

const PATTERNS_FILE = "patterns.json";

type PatternRecord = Record<string, unknown> & {
  fingerprint?: string;
  fingerprint_version?: unknown;
  domain?: unknown;
  topic?: unknown;
  type?: string | null;
  high_value?: boolean;
  technologies?: unknown[];
  activity_ids: unknown[];
  activity_refs?: Array<{ source: string; id: string }>;
  source_hosts?: string[];
  occurrences: number;
  project_ids: unknown[];
  projects: number;
  first_seen?: string | null;
  last_seen?: string | null;
  candidate_id?: unknown;
  state?: string;
};
type ActivityRecord = Record<string, unknown> & {
  id?: unknown;
  fingerprint?: string;
  fingerprint_version?: unknown;
  digest?: Record<string, unknown>;
  domain?: unknown;
  topic?: unknown;
  type?: string;
  metadata?: Record<string, unknown>;
  high_value?: unknown;
  technologies?: unknown[];
  project?: unknown;
  started_at?: string;
  updated_at?: string;
  state?: string;
};
type PatternIndex = {
  schema_version: number;
  patterns: PatternRecord[];
};
type PatternQueryArgs = {
  mode?: string;
  limit?: unknown;
  state?: string;
  since?: string;
  eligible?: unknown;
  fields?: unknown;
  fingerprint?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asPatternIndex(value: unknown): PatternIndex {
  if (!isRecord(value) || !Array.isArray(value.patterns)) {
    return { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] };
  }
  return { schema_version: PATTERN_SCHEMA_VERSION, patterns: value.patterns.filter(isRecord) as PatternRecord[] };
}

function unique(values: unknown[]): unknown[] {
  return [...new Set(values.filter(Boolean))];
}

async function patternsPath(): Promise<string> {
  return path.join(await knowledgeDirPath("indexes"), PATTERNS_FILE);
}

async function readPatterns(): Promise<PatternIndex> {
  return asPatternIndex(await readJson(await patternsPath(), { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] }));
}

async function writePatterns(index: PatternIndex): Promise<void> {
  await writeJson(await patternsPath(), { schema_version: PATTERN_SCHEMA_VERSION, patterns: index.patterns || [] });
}

export async function linkPatternCandidate(fingerprint: unknown, candidateId: unknown) {
  if (!fingerprint || !candidateId) return null;
  const index = await readPatterns();
  const pattern = (index.patterns || []).find((item) => item.fingerprint === fingerprint);
  if (!pattern) return null;
  pattern.candidate_id = candidateId;
  pattern.state = "CANDIDATE";
  await writePatterns(index);
  return pattern;
}

async function readLegacyActivities({ includeIndexed = false } = {}): Promise<ActivitySourceRecord[]> {
  const activitiesDir = path.join(path.dirname(await knowledgeDirPath("indexes")), "activities");
  const items: ActivitySourceRecord[] = [];
  for (const file of await fs.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(activitiesDir, file));
    if (!isRecord(item) || !item.fingerprint || !isRecord(item.digest)) continue;
    if (!includeIndexed && item.state !== "NEW") continue;
    if (item.state === "ARCHIVED") continue;
    items.push({ source: { id: "local", host: "local" }, activity: item as ActivityRecord });
  }
  return items;
}

async function readActivities({ includeIndexed = false } = {}): Promise<ActivitySourceRecord[]> {
  const sources = await discoverActivitySources();
  if (sources.length === 0) return readLegacyActivities({ includeIndexed });
  const records = (await Promise.all(sources.map((source) => source.readActivities()))).flat();
  return includeIndexed ? records : records.filter(({ activity }) => activity.state === "NEW");
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickFields(item: PatternRecord, fields: unknown): Record<string, unknown> {
  if (!Array.isArray(fields) || fields.length === 0) return item;
  return Object.fromEntries(
    fields
      .filter((field): field is string => typeof field === "string" && field in item)
      .map((field) => [field, item[field]]),
  );
}

function patternFromActivity(activity: ActivityRecord): PatternRecord {
  const digest = isRecord(activity.digest) ? activity.digest : {};
  return {
    schema_version: PATTERN_SCHEMA_VERSION,
    fingerprint: activity.fingerprint as string,
    fingerprint_version: activity.fingerprint_version,
    domain: digest.domain || activity.domain || null,
    topic: digest.topic || activity.topic || null,
    type: stringOrNull(digest.type || activity.type || activity.metadata?.type),
    high_value: Boolean(digest.high_value || activity.high_value || activity.metadata?.high_value),
    technologies: arrayValue(digest.technologies || activity.technologies),
    activity_ids: [],
    occurrences: 0,
    project_ids: [],
    projects: 0,
    first_seen: activity.started_at || activity.updated_at || null,
    last_seen: activity.updated_at || activity.started_at || null,
    candidate_id: null,
    state: "OBSERVED",
  };
}

function upsertPattern(patterns: PatternRecord[], record: ActivitySourceRecord): boolean {
  const { source } = record;
  const activity = record.activity as ActivityRecord;
  const digest = isRecord(activity.digest) ? activity.digest : {};
  let pattern = patterns.find((item) => item.fingerprint === activity.fingerprint);
  if (!pattern) {
    pattern = patternFromActivity(activity);
    patterns.push(pattern);
  }
  const ref = { source: source.id, id: String(activity.id || "") };
  const refKey = `${ref.source}:${ref.id}`;
  const existingRefs = Array.isArray(pattern.activity_refs) ? pattern.activity_refs : [];
  const existingKeys = new Set(existingRefs.map((item) => `${item.source}:${item.id}`));
  if (!ref.id || existingKeys.has(refKey)) return false;
  pattern.activity_refs = [...existingRefs, ref];
  pattern.source_hosts = unique([...(pattern.source_hosts || []), source.host]) as string[];
  pattern.activity_ids = unique([...pattern.activity_ids, activity.id]);
  pattern.occurrences = pattern.activity_refs.length;
  pattern.project_ids = unique([...(pattern.project_ids || []), activity.project]);
  pattern.projects = pattern.project_ids.length;
  pattern.first_seen =
    [pattern.first_seen, activity.started_at || activity.updated_at].filter(Boolean).sort()[0] || null;
  pattern.last_seen =
    [pattern.last_seen, activity.updated_at || activity.started_at].filter(Boolean).sort().at(-1) || null;
  pattern.high_value = Boolean(
    pattern.high_value || digest.high_value || activity.high_value || activity.metadata?.high_value,
  );
  return true;
}

async function advanceIngestionState(records: ActivitySourceRecord[]): Promise<void> {
  const state = await loadIngestionState();
  for (const { source, activity } of records) {
    const current = state.sources[source.id] || {};
    const seenAt = activity.updated_at || activity.started_at || current.last_seen_at || null;
    const recent = [activity.id, ...(current.recent_ids || [])].filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    const next: { last_seen_at?: string | null; recent_ids: string[] } = {
      recent_ids: [...new Set(recent)].slice(0, 100),
    };
    next.last_seen_at =
      [current.last_seen_at, seenAt]
        .filter((item): item is string => typeof item === "string")
        .sort()
        .at(-1) || null;
    state.sources[source.id] = next;
  }
  await saveIngestionState(state);
}

export async function indexNewActivities() {
  const started = Date.now();
  const records = await readActivities();
  const index = await readPatterns();
  let indexed = 0;
  for (const record of records) {
    if (upsertPattern(index.patterns, record)) indexed++;
  }
  await writePatterns(index);
  await advanceIngestionState(records);
  const result = {
    mode: "incremental",
    indexed,
    patterns: index.patterns.length,
  };
  await writeEvent("PatternIndexUpdated", result);
  const input = { digests: records.map(({ activity }) => activity.digest || activity), patterns: index.patterns };
  const budget = await checkContextBudget("pattern_judge", {
    required: { digests: input.digests },
    recommended: { patterns: index.patterns },
  });
  await recordIntelligenceRun({
    stage: "pattern_judge",
    input,
    output: result,
    evidence_loaded: indexed,
    skills_loaded: 0,
    full_activity_load: true,
    full_skill_load: false,
    duration_ms: Date.now() - started,
    budget,
  });
  return result;
}

export async function rebuildPatternIndex() {
  const started = Date.now();
  const records = await readActivities({ includeIndexed: true });
  const index: PatternIndex = { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] };
  let indexed = 0;
  for (const record of records) {
    if (upsertPattern(index.patterns, record)) indexed++;
  }
  await writePatterns(index);
  await advanceIngestionState(records);
  const result = {
    mode: "rebuild",
    indexed,
    patterns: index.patterns.length,
  };
  await writeEvent("PatternIndexUpdated", result);
  const input = { digests: records.map(({ activity }) => activity.digest || activity), patterns: index.patterns };
  const budget = await checkContextBudget("pattern_judge", {
    required: { digests: input.digests },
    recommended: { patterns: index.patterns },
  });
  await recordIntelligenceRun({
    stage: "pattern_judge",
    input,
    output: result,
    evidence_loaded: indexed,
    skills_loaded: 0,
    full_activity_load: true,
    full_skill_load: false,
    duration_ms: Date.now() - started,
    budget,
  });
  return result;
}

export async function queryPatterns(args: PatternQueryArgs = {}) {
  const config = await loadConfig();
  const minOccurrences =
    typeof config.intelligence?.candidate_min_occurrences === "number"
      ? config.intelligence.candidate_min_occurrences
      : 2;
  const limit = listLimit(args.limit);
  const index = await readPatterns();
  let patterns = index.patterns || [];
  if (args.state) patterns = patterns.filter((pattern) => pattern.state === args.state);
  if (args.since) {
    const since = args.since;
    patterns = patterns.filter((pattern) => (pattern.last_seen || pattern.first_seen || "") >= since);
  }
  if (args.eligible) {
    patterns = patterns.filter(
      (pattern) => pattern.high_value || (pattern.type !== "routine" && pattern.occurrences >= minOccurrences),
    );
  }
  patterns = patterns
    .slice()
    .sort((a, b) => (b.last_seen || "").localeCompare(a.last_seen || "") || b.occurrences - a.occurrences);
  return { count: patterns.length, patterns: patterns.slice(0, limit).map((item) => pickFields(item, args.fields)) };
}

export async function handlePatternIndex(args: PatternQueryArgs = {}) {
  return withKnowledgeLock("patterns", () => (args.mode === "rebuild" ? rebuildPatternIndex() : indexNewActivities()));
}

export async function handlePatternQuery(args: PatternQueryArgs = {}) {
  return queryPatterns(args);
}

export async function handlePatternGet(args: PatternQueryArgs = {}) {
  const index = await readPatterns();
  const pattern = (index.patterns || []).find((item) => item.fingerprint === args.fingerprint);
  if (!pattern) throw Error("Pattern not found");
  return pickFields(pattern, args.fields);
}
