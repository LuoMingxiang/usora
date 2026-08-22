import fs from "node:fs/promises";
import path from "node:path";
import { transitionActivityState } from "./activities.mjs";
import { checkContextBudget, recordIntelligenceRun } from "./context-budget.mjs";
import { PATTERN_SCHEMA_VERSION, dirPath, loadConfig, readJson, writeEvent, writeJson } from "./storage.mjs";
import { listLimit } from "./validation.mjs";

const PATTERNS_FILE = "patterns.json";

async function patternsPath() {
  return path.join(await dirPath("indexes"), PATTERNS_FILE);
}

async function readPatterns() {
  return readJson(await patternsPath(), { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] });
}

async function writePatterns(index) {
  await writeJson(await patternsPath(), { schema_version: PATTERN_SCHEMA_VERSION, patterns: index.patterns || [] });
}

export async function linkPatternCandidate(fingerprint, candidateId) {
  if (!fingerprint || !candidateId) return null;
  const index = await readPatterns();
  const pattern = (index.patterns || []).find((item) => item.fingerprint === fingerprint);
  if (!pattern) return null;
  pattern.candidate_id = candidateId;
  pattern.state = "CANDIDATE";
  await writePatterns(index);
  return pattern;
}

async function readActivities({ includeIndexed = false } = {}) {
  const activitiesDir = await dirPath("activities");
  const items = [];
  for (const file of await fs.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(activitiesDir, file));
    if (!item?.fingerprint || !item?.digest) continue;
    if (!includeIndexed && item.state !== "NEW") continue;
    if (item.state === "ARCHIVED") continue;
    items.push({ file, item });
  }
  return items;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function pickFields(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0) return item;
  return Object.fromEntries(fields.filter((field) => field in item).map((field) => [field, item[field]]));
}

function patternFromActivity(activity) {
  return {
    schema_version: PATTERN_SCHEMA_VERSION,
    fingerprint: activity.fingerprint,
    fingerprint_version: activity.fingerprint_version,
    domain: activity.digest?.domain || activity.domain || null,
    topic: activity.digest?.topic || activity.topic || null,
    type: activity.digest?.type || activity.type || activity.metadata?.type || null,
    high_value: Boolean(activity.digest?.high_value || activity.high_value || activity.metadata?.high_value),
    technologies: activity.digest?.technologies || activity.technologies || [],
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

function upsertPattern(patterns, activity) {
  let pattern = patterns.find((item) => item.fingerprint === activity.fingerprint);
  if (!pattern) {
    pattern = patternFromActivity(activity);
    patterns.push(pattern);
  }
  pattern.activity_ids = unique([...pattern.activity_ids, activity.id]);
  pattern.occurrences = pattern.activity_ids.length;
  pattern.project_ids = unique([...(pattern.project_ids || []), activity.project]);
  pattern.projects = pattern.project_ids.length;
  pattern.first_seen =
    [pattern.first_seen, activity.started_at || activity.updated_at].filter(Boolean).sort()[0] || null;
  pattern.last_seen =
    [pattern.last_seen, activity.updated_at || activity.started_at].filter(Boolean).sort().at(-1) || null;
  pattern.high_value = Boolean(
    pattern.high_value || activity.digest?.high_value || activity.high_value || activity.metadata?.high_value,
  );
  return pattern;
}

async function updateActivityState(file, activity) {
  transitionActivityState(activity, "INDEXED");
  await writeJson(path.join(await dirPath("activities"), file), activity);
}

export async function indexNewActivities() {
  const started = Date.now();
  const records = await readActivities();
  const index = await readPatterns();
  for (const { item } of records) upsertPattern(index.patterns, item);
  await writePatterns(index);
  for (const { file, item } of records) await updateActivityState(file, item);
  const result = {
    mode: "incremental",
    indexed: records.length,
    patterns: index.patterns.length,
  };
  await writeEvent("PatternIndexUpdated", result);
  const input = { digests: records.map(({ item }) => item.digest || item), patterns: index.patterns };
  const budget = await checkContextBudget("pattern_judge", {
    required: { digests: input.digests },
    recommended: { patterns: index.patterns },
  });
  await recordIntelligenceRun({
    stage: "pattern_judge",
    input,
    output: result,
    evidence_loaded: records.length,
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
  const index = { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] };
  for (const { item } of records) upsertPattern(index.patterns, item);
  await writePatterns(index);
  const result = {
    mode: "rebuild",
    indexed: records.length,
    patterns: index.patterns.length,
  };
  await writeEvent("PatternIndexUpdated", result);
  const input = { digests: records.map(({ item }) => item.digest || item), patterns: index.patterns };
  const budget = await checkContextBudget("pattern_judge", {
    required: { digests: input.digests },
    recommended: { patterns: index.patterns },
  });
  await recordIntelligenceRun({
    stage: "pattern_judge",
    input,
    output: result,
    evidence_loaded: records.length,
    skills_loaded: 0,
    full_activity_load: true,
    full_skill_load: false,
    duration_ms: Date.now() - started,
    budget,
  });
  return result;
}

export async function queryPatterns(args = {}) {
  const config = await loadConfig();
  const minOccurrences = config.intelligence?.candidate_min_occurrences || 2;
  const limit = listLimit(args.limit);
  const index = await readPatterns();
  let patterns = index.patterns || [];
  if (args.state) patterns = patterns.filter((pattern) => pattern.state === args.state);
  if (args.since)
    patterns = patterns.filter((pattern) => (pattern.last_seen || pattern.first_seen || "") >= args.since);
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

export async function handlePatternIndex(args = {}) {
  return args.mode === "rebuild" ? rebuildPatternIndex() : indexNewActivities();
}

export async function handlePatternQuery(args = {}) {
  return queryPatterns(args);
}

export async function handlePatternGet(args = {}) {
  const index = await readPatterns();
  const pattern = (index.patterns || []).find((item) => item.fingerprint === args.fingerprint);
  if (!pattern) throw Error("Pattern not found");
  return pickFields(pattern, args.fields);
}
