import fs from "node:fs/promises";
import path from "node:path";
import { checkContextBudget, recordIntelligenceRun } from "./context-budget.ts";
import { withKnowledgeLock } from "./lock.ts";
import { linkPatternCandidate } from "./patterns.ts";
import { CANDIDATE_SCHEMA_VERSION, knowledgeDirPath, newId, now, readJson, writeEvent, writeJson } from "./storage.ts";
import { listLimit, safeName } from "./validation.ts";

type JsonRecord = Record<string, unknown>;
type CandidateRecord = JsonRecord & {
  id?: string;
  title?: string;
  name?: string;
  summary?: string;
  description?: string;
  domain?: unknown;
  topic?: unknown;
  tags?: unknown;
  technologies?: unknown;
  fingerprint?: unknown;
  pattern_fingerprint?: unknown;
  activity_refs?: unknown;
  source_hosts?: unknown;
  contributing_sources?: unknown;
  evidence?: unknown;
  occurrences?: number;
  state?: string;
  updated_at?: string;
  created_at?: string;
  score?: number;
};
type CandidateArgs = JsonRecord & {
  id?: unknown;
  title?: unknown;
  summary?: unknown;
  evidence?: unknown;
  tags?: unknown;
  technologies?: unknown;
  fingerprint?: unknown;
  pattern_fingerprint?: unknown;
  limit?: unknown;
  threshold?: unknown;
  high_value?: unknown;
  occurrences?: unknown;
  state?: string;
  since?: string;
  fields?: unknown;
  result?: string;
  reviewer?: string;
};
type MatchRecord = CandidateRecord & {
  score: number;
  reasons: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeEvidence(evidence: unknown = []): JsonRecord[] {
  return asArray(evidence).map((item) =>
    typeof item === "string" ? { activity_id: item, reason: "" } : { ...(isRecord(item) ? item : {}) },
  );
}

function words(value: unknown): Set<string> {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / new Set([...left, ...right]).size;
}

function recordText(item: CandidateRecord): string {
  return [
    item.title,
    item.name,
    item.summary,
    item.description,
    item.domain,
    item.topic,
    ...asArray(item.tags),
    ...asArray(item.technologies),
  ].join(" ");
}

function scoreMatch(target: CandidateRecord, item: CandidateRecord): { score: number; reasons: string[] } {
  if (target.fingerprint && target.fingerprint === item.fingerprint) {
    return { score: 1, reasons: ["fingerprint"] };
  }
  const titleScore = jaccard(words(target.title), words(item.title || item.name));
  const summaryScore = jaccard(words(target.summary), words(item.summary || item.description));
  const techScore = jaccard(words(asArray(target.technologies).join(" ")), words(asArray(item.technologies).join(" ")));
  const topicScore = jaccard(words(target.topic), words(item.topic));
  const tagScore = jaccard(words(asArray(target.tags).join(" ")), words(asArray(item.tags).join(" ")));
  const textScore = jaccard(words(recordText(target)), words(recordText(item)));
  const score =
    0.35 * titleScore + 0.25 * summaryScore + 0.15 * techScore + 0.1 * topicScore + 0.1 * tagScore + 0.05 * textScore;
  return {
    score: Number(score.toFixed(3)),
    reasons: [
      titleScore >= 0.8 ? "title" : null,
      summaryScore >= 0.6 ? "summary" : null,
      techScore > 0 ? "technologies" : null,
      topicScore > 0 ? "topic" : null,
      tagScore > 0 ? "tags" : null,
    ].filter((reason): reason is string => typeof reason === "string"),
  };
}

async function readCandidates(): Promise<CandidateRecord[]> {
  const candidatesDir = await knowledgeDirPath("candidates");
  const items: CandidateRecord[] = [];
  for (const file of await fs.readdir(candidatesDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(candidatesDir, file));
    if (isRecord(item)) items.push(item);
  }
  return items;
}

async function readSkills(): Promise<CandidateRecord[]> {
  const skillsDir = await knowledgeDirPath("skills");
  const items: CandidateRecord[] = [];
  for (const dir of await fs.readdir(skillsDir).catch(() => [])) {
    const item = await readJson(path.join(skillsDir, dir, "skill.json"));
    if (!isRecord(item)) continue;
    const { content: _content, ...summary } = item;
    items.push(summary);
  }
  return items;
}

function topMatches(target: CandidateRecord, items: CandidateRecord[], limit: number): MatchRecord[] {
  return items
    .map((item) => ({ ...scoreMatch(target, item), item }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, ...match }) => ({ ...match, ...item }));
}

function pickFields(item: CandidateRecord, fields: unknown): Record<string, unknown> {
  if (!Array.isArray(fields) || fields.length === 0) return item;
  return Object.fromEntries(
    fields
      .filter((field): field is string => typeof field === "string" && field in item)
      .map((field) => [field, item[field]]),
  );
}

/**
 * `candidate_create`: record a reusable pattern as a new Candidate.
 *
 * @param {ToolArgs} args - `title`, `summary`, optional `evidence` and `source`.
 * @returns {Promise<object>} The created Candidate.
 * @throws {Error} When `title` or `summary` is missing.
 */
export async function handleCandidateCreate(args: CandidateArgs) {
  return withKnowledgeLock("candidates", () => createCandidate(args));
}

async function createCandidate(args: CandidateArgs) {
  if (!args.title || !args.summary) {
    throw Error("title and summary are required");
  }
  const evidence = normalizeEvidence(args.evidence);
  const item = {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    id: newId("candidate"),
    title: args.title,
    summary: args.summary,
    domain: args.domain || null,
    topic: args.topic || null,
    tags: asArray(args.tags),
    technologies: asArray(args.technologies),
    fingerprint: args.fingerprint || args.pattern_fingerprint || null,
    occurrences: Number(args.occurrences) || evidence.length || 1,
    confidence: args.confidence ?? null,
    source: args.source || "codex",
    evidence,
    contributing_sources: asArray(args.contributing_sources || args.source_hosts),
    resolution: args.resolution || null,
    resolution_reason: args.resolution_reason || "",
    merge_target: args.merge_target || null,
    created_at: now(),
    updated_at: now(),
    state: args.state || "OPEN",
  };
  await writeJson(path.join(await knowledgeDirPath("candidates"), `${item.id}.json`), item);
  await writeEvent("CandidateCreated", item);
  return item;
}

/**
 * `candidate_list`: list recent Candidates.
 *
 * @param {ToolArgs} [args={}] - Optional `limit` (default 20, max 100). Default is `{}`
 * @returns {Promise<object>} Count and recent Candidates.
 */
export async function handleCandidateList(args: CandidateArgs = {}) {
  const limit = listLimit(args.limit);
  const items = await readCandidates();
  items.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return { count: items.length, candidates: items.slice(0, limit) };
}

export async function handleCandidateMatch(args: CandidateArgs = {}) {
  const limit = listLimit(args.limit || 5);
  const target = {
    title: text(args.title),
    summary: text(args.summary),
    topic: args.topic || null,
    tags: asArray(args.tags),
    technologies: asArray(args.technologies),
    fingerprint: args.fingerprint || args.pattern_fingerprint || null,
  };
  const candidates = (await readCandidates()).filter((item) => item.state !== "REJECTED" && item.state !== "DROPPED");
  const skills = await readSkills();
  return {
    candidates: topMatches(target, candidates, limit),
    skills: topMatches(target, skills, limit),
  };
}

export async function handleCandidateQuery(args: CandidateArgs = {}) {
  const limit = listLimit(args.limit);
  let candidates = await readCandidates();
  if (args.state) candidates = candidates.filter((candidate) => candidate.state === args.state);
  if (args.since) {
    const since = args.since;
    candidates = candidates.filter((candidate) => (candidate.updated_at || candidate.created_at || "") >= since);
  }
  candidates.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return {
    count: candidates.length,
    candidates: candidates.slice(0, limit).map((item) => pickFields(item, args.fields)),
  };
}

export async function handleCandidateGet(args: CandidateArgs = {}) {
  const id = safeName(args.id, "id");
  const candidate = await readJson(path.join(await knowledgeDirPath("candidates"), `${id}.json`));
  if (!isRecord(candidate)) throw Error("Candidate not found");
  return pickFields(candidate, args.fields);
}

export async function handleCandidateResolve(args: CandidateArgs = {}) {
  return withKnowledgeLock("candidates", () => resolveCandidate(args));
}

async function resolveCandidate(args: CandidateArgs = {}) {
  if (!args.title || !args.summary) {
    throw Error("title and summary are required");
  }
  const started = Date.now();
  const threshold = Number(args.threshold) || 0.62;
  const matches = await handleCandidateMatch(args);
  const budget = await checkContextBudget("candidate_resolver", {
    required: { title: args.title, summary: args.summary, technologies: args.technologies, tags: args.tags },
    recommended: { candidates: matches.candidates.slice(0, 5), skills: matches.skills.slice(0, 5) },
    optional: { evidence: normalizeEvidence(args.evidence).slice(0, 3) },
  });
  const bestCandidate = matches.candidates[0];
  const bestSkill = matches.skills[0];

  if (bestCandidate && bestCandidate.score >= threshold) {
    if (args.pattern_fingerprint) await linkPatternCandidate(args.pattern_fingerprint, bestCandidate.id);
    const result = {
      action: "matched",
      candidate: bestCandidate,
      resolution_reason: "matched existing Candidate",
      merge_target: { type: "candidate", id: bestCandidate.id, score: bestCandidate.score },
      matches,
    };
    await writeEvent("CandidateResolved", result);
    await recordIntelligenceRun({
      stage: "candidate_resolver",
      input: { args, matches },
      output: result,
      evidence_loaded: normalizeEvidence(args.evidence).length,
      skills_loaded: matches.skills.length,
      full_activity_load: false,
      full_skill_load: false,
      cache_hit: true,
      duration_ms: Date.now() - started,
      budget,
    });
    return result;
  }
  if (bestSkill && bestSkill.score >= threshold) {
    const result = {
      action: "matched",
      candidate: null,
      resolution_reason: "matched existing Skill",
      merge_target: { type: "skill", id: bestSkill.name, score: bestSkill.score },
      matches,
    };
    await writeEvent("CandidateResolved", result);
    await recordIntelligenceRun({
      stage: "candidate_resolver",
      input: { args, matches },
      output: result,
      evidence_loaded: normalizeEvidence(args.evidence).length,
      skills_loaded: matches.skills.length,
      full_activity_load: false,
      full_skill_load: false,
      cache_hit: true,
      duration_ms: Date.now() - started,
      budget,
    });
    return result;
  }

  const shouldDrop = !args.high_value && (Number(args.occurrences) || normalizeEvidence(args.evidence).length || 1) < 2;
  const candidate = await handleCandidateCreate({
    ...args,
    resolution: shouldDrop ? "DROP" : "CREATE",
    resolution_reason: shouldDrop ? "insufficient evidence" : "no local match",
    state: shouldDrop ? "DROPPED" : "OPEN",
  });
  if (args.pattern_fingerprint && !shouldDrop) await linkPatternCandidate(args.pattern_fingerprint, candidate.id);
  const result = { action: shouldDrop ? "dropped" : "created", candidate, matches };
  await writeEvent("CandidateResolved", result);
  await recordIntelligenceRun({
    stage: "candidate_resolver",
    input: { args, matches },
    output: result,
    evidence_loaded: normalizeEvidence(args.evidence).length,
    skills_loaded: matches.skills.length,
    full_activity_load: false,
    full_skill_load: false,
    cache_hit: false,
    duration_ms: Date.now() - started,
    budget,
  });
  return result;
}

/**
 * `candidate_evaluate`: mark a Candidate as pass or fail.
 *
 * @param {ToolArgs} args - `id` and `result` ("pass"|"fail"), optional `reviewer`.
 * @returns {Promise<object>} The updated Candidate.
 * @throws {Error} When the Candidate does not exist.
 */
export async function handleCandidateEvaluate(args: CandidateArgs) {
  return withKnowledgeLock("candidates", () => evaluateCandidate(args));
}

async function evaluateCandidate(args: CandidateArgs) {
  if (args.result !== "pass" && args.result !== "fail") throw Error("result must be pass or fail");
  const file = path.join(await knowledgeDirPath("candidates"), `${safeName(args.id, "id")}.json`);
  const item = await readJson(file);
  if (!isRecord(item)) throw Error("Candidate not found");
  const requests = isRecord(item.integration_requests) ? item.integration_requests : {};
  if (typeof args.request_id === "string" && Object.hasOwn(requests, args.request_id)) {
    const receipt = requests[args.request_id] as { type: string; data: JsonRecord };
    await writeEvent("ReviewSubmitted", receipt.data, `${args.id}:${args.request_id}`);
    await writeEvent(receipt.type, receipt.data, `${args.id}:${args.request_id}`);
    return item;
  }

  item.evaluation = {
    result: args.result,
    reviewer: args.reviewer || "codex",
    evaluated_at: now(),
  };
  item.state = args.result === "pass" ? "EVALUATED" : "REJECTED";
  const eventType = args.result === "pass" ? "candidate.approved" : "candidate.rejected";
  const { integration_requests: _requests, ...snapshot } = item;
  const requestId = typeof args.request_id === "string" ? args.request_id : undefined;
  if (requestId) item.integration_requests = { ...requests, [requestId]: { type: eventType, data: snapshot } };

  await writeJson(file, item);
  const eventKey = requestId ? `${args.id}:${requestId}` : undefined;
  await writeEvent("ReviewSubmitted", snapshot, eventKey);
  await writeEvent(eventType, snapshot, eventKey);
  return item;
}
