#!/usr/bin/env node

// plugins/foundry/src/mcp/server.ts
import readline from "node:readline";
import { readFileSync } from "node:fs";
import { fileURLToPath as fileURLToPath3 } from "node:url";
import path20 from "node:path";

// plugins/foundry/src/core/storage.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
var runtimeDir = path.dirname(fileURLToPath(import.meta.url));
var runtimePluginRoot = path.basename(runtimeDir) === "dist" ? path.resolve(runtimeDir, "..") : path.resolve(runtimeDir, "..", "..");
var lowerRuntimePluginRoot = runtimePluginRoot.toLowerCase();
var isCodeBuddyInstall = lowerRuntimePluginRoot.includes(path.join(".codebuddy", "plugins", "marketplaces").toLowerCase());
var isCodexInstall = lowerRuntimePluginRoot.includes(path.join(".codex", "plugins", "cache").toLowerCase());
var anchorHome = process.env.CODEBUDDY_PLUGIN_DATA ? path.resolve(process.env.CODEBUDDY_PLUGIN_DATA, ".usora") : process.env.PLUGIN_DATA ? path.resolve(process.env.PLUGIN_DATA, ".usora") : process.env.CODEBUDDY_PLUGIN_ROOT || isCodeBuddyInstall ? path.join(os.homedir(), ".codebuddy", "plugins", "data", "usora", ".usora") : process.env.CLAUDE_PLUGIN_ROOT || isCodexInstall ? path.join(os.homedir(), ".codex", "plugins", "data", "usora", ".usora") : path.resolve(process.cwd(), ".usora");
var hostHomeSource = process.env.CODEBUDDY_PLUGIN_DATA || process.env.PLUGIN_DATA ? "host_plugin_data" : process.env.CODEBUDDY_PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || isCodeBuddyInstall || isCodexInstall ? "host_plugin_data" : "development";
var knowledgeHome = process.env.USORA_HOME ? path.resolve(process.env.USORA_HOME) : hostHomeSource === "development" ? anchorHome : path.join(os.homedir(), ".usora");
var _knowledgeHomeSource = process.env.USORA_HOME ? "environment" : hostHomeSource === "development" ? "development" : "default";
var processSessionId = `session-${Date.now().toString(16).padStart(12, "0")}-${crypto.randomBytes(16).toString("hex")}`;
var HUB_SCHEMA_VERSION = 2;
var ACTIVITY_SCHEMA_VERSION = 2;
var CANDIDATE_SCHEMA_VERSION = 2;
var PATTERN_SCHEMA_VERSION = 1;
var SKILL_METADATA_SCHEMA_VERSION = 2;
var EVENT_SCHEMA_VERSION = 1;
var DIRS = [
  "activities",
  "candidates",
  "skills",
  "usage",
  "archive",
  "events",
  "sessions",
  "indexes",
  "backups"
];
var HOST_DIRS = ["activities", "sessions", "runtime", "archive"];
var KNOWLEDGE_DIRS = ["candidates", "skills", "usage", "archive", "events", "indexes", "backups"];
var AUTOMATION_POLICIES = ["auto_publish", "manual_approval", "auto_generate_manual_publish"];
var ARCHIVABLE_STATES = ["PROCESSED", "USED", "ABSORBED"];
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
var now = () => new Date().toISOString();
var newId = (prefix) => `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
async function resolveHome(config) {
  const cfg = config || await loadConfig();
  return typeof cfg.hub_path === "string" && cfg.hub_path ? path.resolve(cfg.hub_path) : anchorHome;
}
async function resolveHostHome(config) {
  return resolveHome(config);
}
async function resolveKnowledgeHome() {
  return knowledgeHome;
}
async function hostDirPath(dir) {
  return path.join(await resolveHostHome(), dir);
}
async function knowledgeDirPath(dir) {
  return path.join(await resolveKnowledgeHome(), dir);
}
async function ensure() {
  const host = await resolveHostHome();
  const knowledge = await resolveKnowledgeHome();
  await Promise.all([
    ...HOST_DIRS.map((dir) => fs.mkdir(path.join(host, dir), { recursive: true })),
    ...KNOWLEDGE_DIRS.map((dir) => fs.mkdir(path.join(knowledge, dir), { recursive: true }))
  ]);
}
async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === "" || !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
}
async function copyHubData(sourceHome, targetHome) {
  if (path.resolve(sourceHome) === path.resolve(targetHome))
    return;
  for (const dir of DIRS) {
    const src = path.join(sourceHome, dir);
    if (!await exists(src))
      continue;
    await fs.mkdir(path.join(targetHome, dir), { recursive: true });
    await fs.cp(src, path.join(targetHome, dir), { recursive: true, force: false, errorOnExist: false });
  }
}
async function migrateLegacyConfig() {
  const currentConfig = path.join(anchorHome, "config.json");
  if (await exists(currentConfig))
    return null;
  const legacyHomes = [path.join(runtimePluginRoot, ".usora"), path.resolve(process.cwd(), ".usora")];
  for (const legacyHome of legacyHomes) {
    const config = await readJson(path.join(legacyHome, "config.json"));
    if (!isObject(config))
      continue;
    const legacyHub = typeof config.hub_path === "string" && config.hub_path ? path.resolve(config.hub_path) : legacyHome;
    if (legacyHome !== path.join(runtimePluginRoot, ".usora") && !isInside(runtimePluginRoot, legacyHub))
      continue;
    await copyHubData(legacyHub, anchorHome);
    const next = { ...config };
    if (isInside(runtimePluginRoot, legacyHub)) {
      delete next.hub_path;
    }
    await saveConfig(next);
    return normalizeConfig(next);
  }
  return null;
}
async function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}
`, "utf8");
  await fs.rename(tmp, file);
}
async function writeEvent(type, data) {
  const file = path.join(await knowledgeDirPath("events"), `${Date.now()}-${newId("event")}.json`);
  await writeJson(file, { schema_version: EVENT_SCHEMA_VERSION, type, timestamp: now(), data });
}
function normalizeConfig(value) {
  return {
    maintainer: typeof value.maintainer === "string" ? value.maintainer : "codex",
    automation_policy: typeof value.automation_policy === "string" ? value.automation_policy : "manual_approval",
    ...value,
    version: typeof value.version === "number" ? value.version : HUB_SCHEMA_VERSION,
    hub_schema_version: typeof value.hub_schema_version === "number" ? value.hub_schema_version : typeof value.version === "number" ? value.version : HUB_SCHEMA_VERSION,
    intelligence: {
      candidate_min_occurrences: 2,
      ...isObject(value.intelligence) ? value.intelligence : {}
    }
  };
}
async function loadConfig() {
  const migrated = await migrateLegacyConfig();
  if (migrated)
    return migrated;
  const config = await readJson(path.join(anchorHome, "config.json"), {
    maintainer: "codex",
    automation_policy: "manual_approval",
    version: HUB_SCHEMA_VERSION,
    hub_schema_version: HUB_SCHEMA_VERSION,
    intelligence: { candidate_min_occurrences: 2 }
  });
  return normalizeConfig(config || {});
}
async function saveConfig(value) {
  const next = normalizeConfig(value);
  await fs.mkdir(anchorHome, { recursive: true });
  await writeJson(path.join(anchorHome, "config.json"), next);
  return next;
}

// plugins/foundry/src/core/activities.ts
import fs2 from "node:fs/promises";
import path3 from "node:path";

// plugins/foundry/src/core/intelligence/digest.ts
var LIMITS = {
  task: 200,
  result: 300,
  keyPoint: 160,
  keyPoints: 5,
  technologies: 10
};
function compact(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}
function buildActivityDigest(activity) {
  const technologies = Array.isArray(activity.technologies) ? activity.technologies : [];
  const keyPoints = Array.isArray(activity.key_points) ? activity.key_points : [];
  return {
    schema_version: 1,
    id: activity.id,
    project: activity.project || null,
    source: activity.source || null,
    type: activity.type || activity.metadata?.type || null,
    high_value: Boolean(activity.high_value || activity.metadata?.high_value),
    domain: activity.domain || activity.metadata?.domain || null,
    topic: activity.topic || activity.metadata?.topic || null,
    task: compact(activity.task, LIMITS.task),
    result: compact(activity.result, LIMITS.result),
    technologies: technologies.slice(0, LIMITS.technologies),
    key_points: keyPoints.slice(0, LIMITS.keyPoints).map((point) => compact(point, LIMITS.keyPoint)),
    fingerprint: activity.fingerprint || null,
    fingerprint_version: activity.fingerprint_version || null,
    occurrences: activity.occurrences || 1,
    updated_at: activity.updated_at,
    state: activity.state
  };
}

// plugins/foundry/src/core/intelligence/fingerprint.ts
import crypto2 from "node:crypto";
var FINGERPRINT_VERSION = 1;
function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[\\/][\w.-]+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean).slice(0, 24).sort().join(" ");
}
function normalizeList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(normalizeText).filter(Boolean))].sort().join(",");
}
function buildActivityFingerprint(activity) {
  const input = [
    activity.project || "",
    normalizeText(activity.domain || ""),
    normalizeText(activity.topic || ""),
    normalizeList(activity.technologies),
    normalizeText(activity.task || "")
  ].join("|");
  return {
    version: FINGERPRINT_VERSION,
    value: `sha256:${crypto2.createHash("sha256").update(input).digest("hex")}`
  };
}

// plugins/foundry/src/core/validation.ts
import path2 from "node:path";
function requireString(value, field) {
  if (typeof value !== "string") {
    throw Error(`${field} is required`);
  }
  return value;
}
function safeName(value, field) {
  const name = requireString(value, field);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(name)) {
    throw Error(`${field} must contain only letters, numbers, and hyphens`);
  }
  return name;
}
function isInside2(parent, child) {
  const rel = path2.relative(parent, child);
  return Boolean(rel) && !rel.startsWith("..") && !path2.isAbsolute(rel);
}
function mergeUnique(left, right) {
  return [...new Set([...left || [], ...right || []])];
}
function listLimit(value) {
  return Math.min(Math.max(Number(value) || 20, 1), 100);
}

// plugins/foundry/src/core/activities.ts
var RECENT_UPDATE_LIMIT = 10;
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function findActivityBySession(sessionId) {
  const dir = await hostDirPath("activities");
  for (const file of await fs2.readdir(dir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path3.join(dir, file));
    if (!isRecord(item))
      continue;
    if (item?.session_id === sessionId)
      return { file, item };
  }
  return null;
}
async function readActivities() {
  const activitiesDir = await hostDirPath("activities");
  const items = [];
  for (const file of await fs2.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path3.join(activitiesDir, file));
    if (isRecord(item))
      items.push(item);
  }
  return items;
}
function pickFields(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
function normalizeActivityHistory(item) {
  item.recent_updates = item.recent_updates || item.updates || [];
  item.history = item.history || {
    update_count: item.recent_updates.length,
    first_seen: item.started_at || item.recent_updates[0]?.timestamp || null,
    last_seen: item.updated_at || item.recent_updates.at(-1)?.timestamp || null,
    key_points: item.key_points || [],
    segments: []
  };
  delete item.updates;
}
function pushActivityUpdate(item, update) {
  item.recent_updates ||= [];
  item.history ||= { update_count: 0, key_points: [], segments: [] };
  item.recent_updates.push(update);
  item.history.update_count = (item.history.update_count || 0) + 1;
  item.history.first_seen = item.history.first_seen || update.timestamp;
  item.history.last_seen = update.timestamp;
  item.history.key_points = mergeUnique(item.history.key_points, update.key_points);
  if (item.recent_updates.length > RECENT_UPDATE_LIMIT) {
    item.recent_updates = item.recent_updates.slice(-RECENT_UPDATE_LIMIT);
  }
}
function updateHistorySourceRef(item) {
  item.history ||= { update_count: 0, key_points: [], segments: [] };
  if (item.history.source_ref || !item.metadata?.transcript_path)
    return;
  item.history.source_ref = { type: "host_transcript", path: item.metadata.transcript_path };
}
async function captureActivity(args, options = {}) {
  if (options.requireTaskResult !== false && (!args.task || !args.result)) {
    throw Error("task and result are required");
  }
  await ensure();
  const sessionId = args.session_id || processSessionId;
  const existing = await findActivityBySession(sessionId);
  const timestamp = args.timestamp || now();
  const item = existing?.item || {
    schema_version: ACTIVITY_SCHEMA_VERSION,
    id: newId("activity"),
    source: args.source || "codex",
    session_id: sessionId,
    session_id_source: args.session_id ? "provided" : "mcp_process",
    project: args.project || null,
    started_at: timestamp,
    state: "NEW",
    task: null,
    result: null,
    key_points: [],
    recent_updates: [],
    history: {
      update_count: 0,
      first_seen: timestamp,
      last_seen: timestamp,
      key_points: [],
      segments: []
    }
  };
  item.schema_version = item.schema_version || ACTIVITY_SCHEMA_VERSION;
  normalizeActivityHistory(item);
  item.source = args.source || item.source;
  item.project = args.project || item.project;
  item.task = args.task ?? item.task;
  item.context = args.context || item.context || "";
  item.result = args.result ?? item.result;
  item.outcome = args.outcome || item.outcome || "success";
  item.approach = mergeUnique(item.approach, args.approach);
  item.technologies = mergeUnique(item.technologies, args.technologies);
  item.key_points = mergeUnique(item.key_points, args.key_points);
  item.metadata = { ...item.metadata, ...args.metadata };
  updateHistorySourceRef(item);
  pushActivityUpdate(item, {
    timestamp,
    summary: args.summary || args.result || "Session captured",
    key_points: args.key_points || []
  });
  item.updated_at = timestamp;
  const fingerprint = buildActivityFingerprint(item);
  item.fingerprint_version = fingerprint.version;
  item.fingerprint = fingerprint.value;
  item.digest = buildActivityDigest(item);
  const file = existing?.file || `${item.id}.json`;
  await writeJson(path3.join(await hostDirPath("activities"), file), item);
  await writeEvent(existing ? "ActivityUpdated" : "ActivityCreated", item);
  return { ...item, merged: Boolean(existing) };
}
async function handleActivityCapture(args) {
  return captureActivity(args);
}
async function handleActivityList(args = {}) {
  const limit = listLimit(args.limit);
  const items = await readActivities();
  items.sort((a, b) => (b.updated_at || b.started_at || "").localeCompare(a.updated_at || a.started_at || ""));
  return { count: items.length, activities: items.slice(0, limit) };
}
async function handleActivityDigestList(args = {}) {
  const list = await handleActivityList(args);
  return {
    count: list.count,
    activities: list.activities.map((activity) => activity.digest || buildActivityDigest(activity))
  };
}
async function handleActivityQuery(args = {}) {
  const limit = listLimit(args.limit);
  let activities = await readActivities();
  if (args.state)
    activities = activities.filter((activity) => activity.state === args.state);
  if (args.since) {
    const since = args.since;
    activities = activities.filter((activity) => (activity.updated_at || activity.started_at || "") >= since);
  }
  activities.sort((a, b) => (b.updated_at || b.started_at || "").localeCompare(a.updated_at || a.started_at || ""));
  const projection = args.projection || "digest";
  return {
    count: activities.length,
    activities: activities.slice(0, limit).map((activity) => {
      if (args.fields)
        return pickFields(activity, args.fields);
      return projection === "full" ? activity : activity.digest || buildActivityDigest(activity);
    })
  };
}
async function handleActivityGet(args = {}) {
  const id = safeName(args.id, "id");
  const activity = await readJson(path3.join(await hostDirPath("activities"), `${id}.json`));
  if (!isRecord(activity))
    throw Error("Activity not found");
  return pickFields(activity, args.fields);
}

// plugins/foundry/src/core/candidates.ts
import fs7 from "node:fs/promises";
import path10 from "node:path";

// plugins/foundry/src/core/context-budget.ts
import fs3 from "node:fs/promises";
import path4 from "node:path";
var STAGE_BUDGETS = {
  pattern_judge: { required: 1200, recommended: 1200, optional: 600 },
  candidate_resolver: { required: 1600, recommended: 1600, optional: 800 },
  skill_compiler: { required: 2400, recommended: 1800, optional: 1200 },
  evaluator: { required: 1000, recommended: 800, optional: 400 }
};
var BUDGET_PARTS = ["required", "recommended", "optional"];
function jsonChars(value) {
  return JSON.stringify(value ?? null).length;
}
function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}
function average(values) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}
function numberValue(value) {
  return typeof value === "number" ? value : 0;
}
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function partReport(stage, parts = {}) {
  const budget = STAGE_BUDGETS[stage] || STAGE_BUDGETS.candidate_resolver;
  const entries = Object.fromEntries(BUDGET_PARTS.map((kind) => {
    const chars = jsonChars(parts[kind] || {});
    return [kind, { chars, budget_chars: budget[kind], overflow: chars > budget[kind] }];
  }));
  const total_chars = entries.required.chars + entries.recommended.chars + entries.optional.chars;
  const budget_chars = budget.required + budget.recommended + budget.optional;
  return {
    stage,
    ...entries,
    total_chars,
    budget_chars,
    estimated_tokens: estimateTokens(total_chars),
    overflow: total_chars > budget_chars || Object.values(entries).some((entry) => entry.overflow)
  };
}
async function checkContextBudget(stage, parts = {}) {
  const report = partReport(stage, parts);
  if (report.overflow)
    await writeEvent("ContextBudgetOverflow", report);
  return report;
}
async function recordIntelligenceRun(args = {}) {
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
    budget: args.budget || null
  };
  await writeEvent("IntelligenceRun", event);
  return event;
}
async function handleContextBudget(args = {}) {
  return checkContextBudget(args.stage || "candidate_resolver", {
    required: args.required || {},
    recommended: args.recommended || {},
    optional: args.optional || {}
  });
}
async function readEvents() {
  const eventsDir = await knowledgeDirPath("events");
  const items = [];
  for (const file of await fs3.readdir(eventsDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path4.join(eventsDir, file));
    if (isRecord2(item))
      items.push(item);
  }
  return items;
}
async function handleTelemetryMetrics() {
  const events = await readEvents();
  const runs = events.filter((event) => event.type === "IntelligenceRun").map((event) => event.data || {});
  const resolved = events.filter((event) => event.type === "CandidateResolved").map((event) => event.data || {});
  const rawPatternIndex = await readJson(path4.join(await knowledgeDirPath("indexes"), "patterns.json")).catch(() => null);
  const patternIndex = isRecord2(rawPatternIndex) ? rawPatternIndex : {};
  const patterns = Array.isArray(patternIndex.patterns) ? patternIndex.patterns : [];
  return {
    runs: runs.length,
    candidate_merge_rate: resolved.length ? resolved.filter((event) => event.action === "matched" || event.merge_target).length / resolved.length : 0,
    candidate_drop_rate: resolved.length ? resolved.filter((event) => event.action === "dropped").length / resolved.length : 0,
    activity_full_load_avoided: runs.filter((run) => run.full_activity_load === false).length,
    skill_full_load_avoided: runs.filter((run) => run.full_skill_load === false).length,
    avg_context_chars: average(runs.map((run) => numberValue(run.input_chars))),
    avg_evidence_loaded: average(runs.map((run) => numberValue(run.evidence_loaded))),
    pattern_reuse_rate: patterns.length ? patterns.filter((pattern) => pattern.candidate_id).length / patterns.length : 0,
    note: "Token counts are chars/4 estimates only; no absolute token savings are claimed."
  };
}

// plugins/foundry/src/core/lock.ts
import fs4 from "node:fs/promises";
import path5 from "node:path";
var STALE_LOCK_MS = 30000;
var heldLocks = new Set;
async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
async function withKnowledgeLock(name, fn) {
  if (heldLocks.has(name))
    return fn();
  const locksDir = path5.join(await knowledgeDirPath("indexes"), "locks");
  await fs4.mkdir(locksDir, { recursive: true });
  const file = path5.join(locksDir, `${name}.lock`);
  for (let attempt = 0;attempt < 100; attempt++) {
    let handle = null;
    try {
      handle = await fs4.open(file, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
      await handle.close();
      heldLocks.add(name);
      try {
        return await fn();
      } finally {
        heldLocks.delete(name);
        await fs4.rm(file, { force: true });
      }
    } catch (err) {
      await handle?.close().catch(() => {});
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      if (code !== "EEXIST")
        throw err;
      const stat = await fs4.stat(file).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
        await fs4.rm(file, { force: true }).catch(() => {});
      }
      await sleep(25);
    }
  }
  throw Error(`Timed out waiting for ${name} knowledge lock`);
}

// plugins/foundry/src/core/patterns.ts
import fs6 from "node:fs/promises";
import path9 from "node:path";

// plugins/foundry/src/sources/registry.ts
import os2 from "node:os";
import path7 from "node:path";

// plugins/foundry/src/sources/local-activity-source.ts
import fs5 from "node:fs/promises";
import path6 from "node:path";
function isRecord3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function exists2(dir) {
  try {
    await fs5.access(dir);
    return true;
  } catch {
    return false;
  }
}

class LocalActivitySource {
  id;
  host;
  rootResolver;
  constructor(id, host, rootResolver) {
    this.id = id;
    this.host = host;
    this.rootResolver = rootResolver;
  }
  async root() {
    return this.rootResolver();
  }
  async activitiesPath() {
    const root = await this.root();
    return root ? path6.join(root, "activities") : null;
  }
  async discover() {
    const dir = await this.activitiesPath();
    return Boolean(dir && await exists2(dir));
  }
  async readActivities() {
    const dir = await this.activitiesPath();
    if (!dir)
      return [];
    const records = [];
    for (const file of await fs5.readdir(dir).catch(() => [])) {
      if (!file.endsWith(".json"))
        continue;
      const activity = await readJson(path6.join(dir, file));
      if (!isRecord3(activity) || !activity.fingerprint || !isRecord3(activity.digest))
        continue;
      if (activity.state === "ARCHIVED")
        continue;
      records.push({ source: { id: this.id, host: this.host }, activity });
    }
    return records;
  }
}
async function currentHostRoot() {
  return path6.dirname(await hostDirPath("activities"));
}

// plugins/foundry/src/sources/registry.ts
function envPath(name) {
  return process.env[name] ? path7.resolve(process.env[name]) : null;
}
function codebuddyRoot() {
  return path7.join(os2.homedir(), ".codebuddy", "plugins", "data", "usora", ".usora");
}
function codexRoot() {
  return path7.join(os2.homedir(), ".codex", "plugins", "data", "usora", ".usora");
}
function currentHost() {
  return process.env.CODEBUDDY_PLUGIN_DATA || process.env.CODEBUDDY_PLUGIN_ROOT ? "codebuddy" : "codex";
}
function activitySources() {
  const host = currentHost();
  return [
    new LocalActivitySource(host, host, async () => envPath(host === "codebuddy" ? "USORA_CODEBUDDY_HOME" : "USORA_CODEX_HOME") || await currentHostRoot()),
    new LocalActivitySource("codebuddy", "codebuddy", async () => envPath("USORA_CODEBUDDY_HOME") || codebuddyRoot()),
    new LocalActivitySource("codex-home", "codex", async () => envPath("USORA_CODEX_HOME") || codexRoot())
  ];
}
async function discoverActivitySources() {
  const seen = new Set;
  const available = [];
  for (const source of activitySources()) {
    const root = await source.root();
    if (!root)
      continue;
    const key = path7.resolve(root).toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    if (await source.discover())
      available.push(source);
  }
  return available;
}
async function describeActivitySources() {
  const seen = new Set;
  const result = [];
  for (const source of activitySources()) {
    const root = await source.root();
    const key = root ? path7.resolve(root).toLowerCase() : `${source.id}:missing`;
    if (seen.has(key))
      continue;
    seen.add(key);
    result.push({
      id: source.id,
      host: source.host,
      available: await source.discover(),
      root,
      activities: await source.activitiesPath()
    });
  }
  return result;
}

// plugins/foundry/src/sources/ingestion-state.ts
import path8 from "node:path";
async function ingestionStatePath() {
  return path8.join(await knowledgeDirPath("indexes"), "ingestion.json");
}
async function loadIngestionState() {
  const state = await readJson(await ingestionStatePath());
  return state && typeof state === "object" && !Array.isArray(state) && state.sources ? state : { schema_version: 1, sources: {} };
}
async function saveIngestionState(state) {
  await writeJson(await ingestionStatePath(), state);
}

// plugins/foundry/src/core/patterns.ts
var PATTERNS_FILE = "patterns.json";
function isRecord4(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function asPatternIndex(value) {
  if (!isRecord4(value) || !Array.isArray(value.patterns)) {
    return { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] };
  }
  return { schema_version: PATTERN_SCHEMA_VERSION, patterns: value.patterns.filter(isRecord4) };
}
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
async function patternsPath() {
  return path9.join(await knowledgeDirPath("indexes"), PATTERNS_FILE);
}
async function readPatterns() {
  return asPatternIndex(await readJson(await patternsPath(), { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] }));
}
async function writePatterns(index) {
  await writeJson(await patternsPath(), { schema_version: PATTERN_SCHEMA_VERSION, patterns: index.patterns || [] });
}
async function linkPatternCandidate(fingerprint, candidateId) {
  if (!fingerprint || !candidateId)
    return null;
  const index = await readPatterns();
  const pattern = (index.patterns || []).find((item) => item.fingerprint === fingerprint);
  if (!pattern)
    return null;
  pattern.candidate_id = candidateId;
  pattern.state = "CANDIDATE";
  await writePatterns(index);
  return pattern;
}
async function readLegacyActivities({ includeIndexed = false } = {}) {
  const activitiesDir = path9.join(path9.dirname(await knowledgeDirPath("indexes")), "activities");
  const items = [];
  for (const file of await fs6.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path9.join(activitiesDir, file));
    if (!isRecord4(item) || !item.fingerprint || !isRecord4(item.digest))
      continue;
    if (!includeIndexed && item.state !== "NEW")
      continue;
    if (item.state === "ARCHIVED")
      continue;
    items.push({ source: { id: "local", host: "local" }, activity: item });
  }
  return items;
}
async function readActivities2({ includeIndexed = false } = {}) {
  const sources = await discoverActivitySources();
  if (sources.length === 0)
    return readLegacyActivities({ includeIndexed });
  const records = (await Promise.all(sources.map((source) => source.readActivities()))).flat();
  return includeIndexed ? records : records.filter(({ activity }) => activity.state === "NEW");
}
function stringOrNull(value) {
  return typeof value === "string" ? value : null;
}
function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}
function pickFields2(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
function patternFromActivity(activity) {
  const digest = isRecord4(activity.digest) ? activity.digest : {};
  return {
    schema_version: PATTERN_SCHEMA_VERSION,
    fingerprint: activity.fingerprint,
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
    state: "OBSERVED"
  };
}
function upsertPattern(patterns, record) {
  const { source } = record;
  const activity = record.activity;
  const digest = isRecord4(activity.digest) ? activity.digest : {};
  let pattern = patterns.find((item) => item.fingerprint === activity.fingerprint);
  if (!pattern) {
    pattern = patternFromActivity(activity);
    patterns.push(pattern);
  }
  const ref = { source: source.id, id: String(activity.id || "") };
  const refKey = `${ref.source}:${ref.id}`;
  const existingRefs = Array.isArray(pattern.activity_refs) ? pattern.activity_refs : [];
  const existingKeys = new Set(existingRefs.map((item) => `${item.source}:${item.id}`));
  if (!ref.id || existingKeys.has(refKey))
    return false;
  pattern.activity_refs = [...existingRefs, ref];
  pattern.source_hosts = unique([...pattern.source_hosts || [], source.host]);
  pattern.activity_ids = unique([...pattern.activity_ids, activity.id]);
  pattern.occurrences = pattern.activity_refs.length;
  pattern.project_ids = unique([...pattern.project_ids || [], activity.project]);
  pattern.projects = pattern.project_ids.length;
  pattern.first_seen = [pattern.first_seen, activity.started_at || activity.updated_at].filter(Boolean).sort()[0] || null;
  pattern.last_seen = [pattern.last_seen, activity.updated_at || activity.started_at].filter(Boolean).sort().at(-1) || null;
  pattern.high_value = Boolean(pattern.high_value || digest.high_value || activity.high_value || activity.metadata?.high_value);
  return true;
}
async function advanceIngestionState(records) {
  const state = await loadIngestionState();
  for (const { source, activity } of records) {
    const current = state.sources[source.id] || {};
    const seenAt = activity.updated_at || activity.started_at || current.last_seen_at || null;
    const recent = [activity.id, ...current.recent_ids || []].filter((id) => typeof id === "string" && id.length > 0);
    const next = {
      recent_ids: [...new Set(recent)].slice(0, 100)
    };
    next.last_seen_at = [current.last_seen_at, seenAt].filter((item) => typeof item === "string").sort().at(-1) || null;
    state.sources[source.id] = next;
  }
  await saveIngestionState(state);
}
async function indexNewActivities() {
  const started = Date.now();
  const records = await readActivities2();
  const index = await readPatterns();
  let indexed = 0;
  for (const record of records) {
    if (upsertPattern(index.patterns, record))
      indexed++;
  }
  await writePatterns(index);
  await advanceIngestionState(records);
  const result = {
    mode: "incremental",
    indexed,
    patterns: index.patterns.length
  };
  await writeEvent("PatternIndexUpdated", result);
  const input = { digests: records.map(({ activity }) => activity.digest || activity), patterns: index.patterns };
  const budget = await checkContextBudget("pattern_judge", {
    required: { digests: input.digests },
    recommended: { patterns: index.patterns }
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
    budget
  });
  return result;
}
async function rebuildPatternIndex() {
  const started = Date.now();
  const records = await readActivities2({ includeIndexed: true });
  const index = { schema_version: PATTERN_SCHEMA_VERSION, patterns: [] };
  let indexed = 0;
  for (const record of records) {
    if (upsertPattern(index.patterns, record))
      indexed++;
  }
  await writePatterns(index);
  await advanceIngestionState(records);
  const result = {
    mode: "rebuild",
    indexed,
    patterns: index.patterns.length
  };
  await writeEvent("PatternIndexUpdated", result);
  const input = { digests: records.map(({ activity }) => activity.digest || activity), patterns: index.patterns };
  const budget = await checkContextBudget("pattern_judge", {
    required: { digests: input.digests },
    recommended: { patterns: index.patterns }
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
    budget
  });
  return result;
}
async function queryPatterns(args = {}) {
  const config = await loadConfig();
  const minOccurrences = typeof config.intelligence?.candidate_min_occurrences === "number" ? config.intelligence.candidate_min_occurrences : 2;
  const limit = listLimit(args.limit);
  const index = await readPatterns();
  let patterns = index.patterns || [];
  if (args.state)
    patterns = patterns.filter((pattern) => pattern.state === args.state);
  if (args.since) {
    const since = args.since;
    patterns = patterns.filter((pattern) => (pattern.last_seen || pattern.first_seen || "") >= since);
  }
  if (args.eligible) {
    patterns = patterns.filter((pattern) => pattern.high_value || pattern.type !== "routine" && pattern.occurrences >= minOccurrences);
  }
  patterns = patterns.slice().sort((a, b) => (b.last_seen || "").localeCompare(a.last_seen || "") || b.occurrences - a.occurrences);
  return { count: patterns.length, patterns: patterns.slice(0, limit).map((item) => pickFields2(item, args.fields)) };
}
async function handlePatternIndex(args = {}) {
  return withKnowledgeLock("patterns", () => args.mode === "rebuild" ? rebuildPatternIndex() : indexNewActivities());
}
async function handlePatternQuery(args = {}) {
  return queryPatterns(args);
}
async function handlePatternGet(args = {}) {
  const index = await readPatterns();
  const pattern = (index.patterns || []).find((item) => item.fingerprint === args.fingerprint);
  if (!pattern)
    throw Error("Pattern not found");
  return pickFields2(pattern, args.fields);
}

// plugins/foundry/src/core/candidates.ts
function isRecord5(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function asArray(value) {
  return Array.isArray(value) ? value : [];
}
function text(value) {
  return typeof value === "string" ? value : "";
}
function normalizeEvidence(evidence = []) {
  return asArray(evidence).map((item) => typeof item === "string" ? { activity_id: item, reason: "" } : { ...isRecord5(item) ? item : {} });
}
function words(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
}
function jaccard(left, right) {
  if (!left.size || !right.size)
    return 0;
  let shared = 0;
  for (const token of left)
    if (right.has(token))
      shared += 1;
  return shared / new Set([...left, ...right]).size;
}
function recordText(item) {
  return [
    item.title,
    item.name,
    item.summary,
    item.description,
    item.domain,
    item.topic,
    ...asArray(item.tags),
    ...asArray(item.technologies)
  ].join(" ");
}
function scoreMatch(target, item) {
  if (target.fingerprint && target.fingerprint === item.fingerprint) {
    return { score: 1, reasons: ["fingerprint"] };
  }
  const titleScore = jaccard(words(target.title), words(item.title || item.name));
  const summaryScore = jaccard(words(target.summary), words(item.summary || item.description));
  const techScore = jaccard(words(asArray(target.technologies).join(" ")), words(asArray(item.technologies).join(" ")));
  const topicScore = jaccard(words(target.topic), words(item.topic));
  const tagScore = jaccard(words(asArray(target.tags).join(" ")), words(asArray(item.tags).join(" ")));
  const textScore = jaccard(words(recordText(target)), words(recordText(item)));
  const score = 0.35 * titleScore + 0.25 * summaryScore + 0.15 * techScore + 0.1 * topicScore + 0.1 * tagScore + 0.05 * textScore;
  return {
    score: Number(score.toFixed(3)),
    reasons: [
      titleScore >= 0.8 ? "title" : null,
      summaryScore >= 0.6 ? "summary" : null,
      techScore > 0 ? "technologies" : null,
      topicScore > 0 ? "topic" : null,
      tagScore > 0 ? "tags" : null
    ].filter((reason) => typeof reason === "string")
  };
}
async function readCandidates() {
  const candidatesDir = await knowledgeDirPath("candidates");
  const items = [];
  for (const file of await fs7.readdir(candidatesDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path10.join(candidatesDir, file));
    if (isRecord5(item))
      items.push(item);
  }
  return items;
}
async function readSkills() {
  const skillsDir = await knowledgeDirPath("skills");
  const items = [];
  for (const dir of await fs7.readdir(skillsDir).catch(() => [])) {
    const item = await readJson(path10.join(skillsDir, dir, "skill.json"));
    if (!isRecord5(item))
      continue;
    const { content: _content, ...summary } = item;
    items.push(summary);
  }
  return items;
}
function topMatches(target, items, limit) {
  return items.map((item) => ({ ...scoreMatch(target, item), item })).filter((match) => match.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ item, ...match }) => ({ ...match, ...item }));
}
function pickFields3(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
async function handleCandidateCreate(args) {
  return withKnowledgeLock("candidates", () => createCandidate(args));
}
async function createCandidate(args) {
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
    state: args.state || "OPEN"
  };
  await writeJson(path10.join(await knowledgeDirPath("candidates"), `${item.id}.json`), item);
  await writeEvent("CandidateCreated", item);
  return item;
}
async function handleCandidateList(args = {}) {
  const limit = listLimit(args.limit);
  const items = await readCandidates();
  items.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return { count: items.length, candidates: items.slice(0, limit) };
}
async function handleCandidateMatch(args = {}) {
  const limit = listLimit(args.limit || 5);
  const target = {
    title: text(args.title),
    summary: text(args.summary),
    topic: args.topic || null,
    tags: asArray(args.tags),
    technologies: asArray(args.technologies),
    fingerprint: args.fingerprint || args.pattern_fingerprint || null
  };
  const candidates = (await readCandidates()).filter((item) => item.state !== "REJECTED" && item.state !== "DROPPED");
  const skills = await readSkills();
  return {
    candidates: topMatches(target, candidates, limit),
    skills: topMatches(target, skills, limit)
  };
}
async function handleCandidateQuery(args = {}) {
  const limit = listLimit(args.limit);
  let candidates = await readCandidates();
  if (args.state)
    candidates = candidates.filter((candidate) => candidate.state === args.state);
  if (args.since) {
    const since = args.since;
    candidates = candidates.filter((candidate) => (candidate.updated_at || candidate.created_at || "") >= since);
  }
  candidates.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return {
    count: candidates.length,
    candidates: candidates.slice(0, limit).map((item) => pickFields3(item, args.fields))
  };
}
async function handleCandidateGet(args = {}) {
  const id = safeName(args.id, "id");
  const candidate = await readJson(path10.join(await knowledgeDirPath("candidates"), `${id}.json`));
  if (!isRecord5(candidate))
    throw Error("Candidate not found");
  return pickFields3(candidate, args.fields);
}
async function handleCandidateResolve(args = {}) {
  return withKnowledgeLock("candidates", () => resolveCandidate(args));
}
async function resolveCandidate(args = {}) {
  if (!args.title || !args.summary) {
    throw Error("title and summary are required");
  }
  const started = Date.now();
  const threshold = Number(args.threshold) || 0.62;
  const matches = await handleCandidateMatch(args);
  const budget = await checkContextBudget("candidate_resolver", {
    required: { title: args.title, summary: args.summary, technologies: args.technologies, tags: args.tags },
    recommended: { candidates: matches.candidates.slice(0, 5), skills: matches.skills.slice(0, 5) },
    optional: { evidence: normalizeEvidence(args.evidence).slice(0, 3) }
  });
  const bestCandidate = matches.candidates[0];
  const bestSkill = matches.skills[0];
  if (bestCandidate && bestCandidate.score >= threshold) {
    if (args.pattern_fingerprint)
      await linkPatternCandidate(args.pattern_fingerprint, bestCandidate.id);
    const result2 = {
      action: "matched",
      candidate: bestCandidate,
      resolution_reason: "matched existing Candidate",
      merge_target: { type: "candidate", id: bestCandidate.id, score: bestCandidate.score },
      matches
    };
    await writeEvent("CandidateResolved", result2);
    await recordIntelligenceRun({
      stage: "candidate_resolver",
      input: { args, matches },
      output: result2,
      evidence_loaded: normalizeEvidence(args.evidence).length,
      skills_loaded: matches.skills.length,
      full_activity_load: false,
      full_skill_load: false,
      cache_hit: true,
      duration_ms: Date.now() - started,
      budget
    });
    return result2;
  }
  if (bestSkill && bestSkill.score >= threshold) {
    const result2 = {
      action: "matched",
      candidate: null,
      resolution_reason: "matched existing Skill",
      merge_target: { type: "skill", id: bestSkill.name, score: bestSkill.score },
      matches
    };
    await writeEvent("CandidateResolved", result2);
    await recordIntelligenceRun({
      stage: "candidate_resolver",
      input: { args, matches },
      output: result2,
      evidence_loaded: normalizeEvidence(args.evidence).length,
      skills_loaded: matches.skills.length,
      full_activity_load: false,
      full_skill_load: false,
      cache_hit: true,
      duration_ms: Date.now() - started,
      budget
    });
    return result2;
  }
  const shouldDrop = !args.high_value && (Number(args.occurrences) || normalizeEvidence(args.evidence).length || 1) < 2;
  const candidate = await handleCandidateCreate({
    ...args,
    resolution: shouldDrop ? "DROP" : "CREATE",
    resolution_reason: shouldDrop ? "insufficient evidence" : "no local match",
    state: shouldDrop ? "DROPPED" : "OPEN"
  });
  if (args.pattern_fingerprint && !shouldDrop)
    await linkPatternCandidate(args.pattern_fingerprint, candidate.id);
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
    budget
  });
  return result;
}
async function handleCandidateEvaluate(args) {
  return withKnowledgeLock("candidates", () => evaluateCandidate(args));
}
async function evaluateCandidate(args) {
  const file = path10.join(await knowledgeDirPath("candidates"), `${safeName(args.id, "id")}.json`);
  const item = await readJson(file);
  if (!isRecord5(item))
    throw Error("Candidate not found");
  item.evaluation = {
    result: args.result,
    reviewer: args.reviewer || "codex",
    evaluated_at: now()
  };
  item.state = args.result === "pass" ? "EVALUATED" : "REJECTED";
  await writeJson(file, item);
  await writeEvent("ReviewSubmitted", item);
  return item;
}

// plugins/foundry/src/core/events.ts
import fs8 from "node:fs/promises";
import path11 from "node:path";
async function handleEventList(args = {}) {
  const limit = listLimit(args.limit);
  const eventsDir = await knowledgeDirPath("events");
  const items = [];
  for (const file of await fs8.readdir(eventsDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path11.join(eventsDir, file));
    if (item && typeof item === "object" && !Array.isArray(item))
      items.push({ ...item, file });
  }
  items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return { count: items.length, events: items.slice(0, limit) };
}

// plugins/foundry/src/core/governance.ts
import path13 from "node:path";

// plugins/foundry/src/core/skill-index.ts
import fs9 from "node:fs/promises";
import path12 from "node:path";
var SKILL_INDEX_FILE = "skills.json";
function isRecord6(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function words2(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
}
function overlap(left, right) {
  if (!left.size || !right.size)
    return 0;
  let shared = 0;
  for (const token of left)
    if (right.has(token))
      shared += 1;
  return shared / new Set([...left, ...right]).size;
}
function pickFields4(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
function skillSummary(meta) {
  const { content: _content, ...summary } = meta;
  return summary;
}
async function skillIndexPath() {
  return path12.join(await knowledgeDirPath("indexes"), SKILL_INDEX_FILE);
}
async function readSkillMetadata() {
  const skillsDir = await knowledgeDirPath("skills");
  const items = [];
  for (const dir of await fs9.readdir(skillsDir).catch(() => [])) {
    const meta = await readJson(path12.join(skillsDir, dir, "skill.json"));
    if (isRecord6(meta))
      items.push(skillSummary(meta));
  }
  return items;
}
async function rebuildSkillIndex() {
  const skills = await readSkillMetadata();
  skills.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  const index = { schema_version: 1, generated_at: now(), skills };
  await writeJson(await skillIndexPath(), index);
  return { count: skills.length, skills };
}
async function querySkillIndex(args = {}) {
  const limit = listLimit(args.limit);
  const indexFile = await skillIndexPath();
  const storedIndex = await readJson(indexFile);
  const index = storedIndex && Array.isArray(storedIndex.skills) ? storedIndex : { skills: (await rebuildSkillIndex()).skills };
  let skills = index.skills;
  if (args.state)
    skills = skills.filter((skill) => skill.state === args.state);
  if (args.candidate_id)
    skills = skills.filter((skill) => skill.source_candidate === args.candidate_id);
  if (args.since) {
    const since = args.since;
    skills = skills.filter((skill) => (skill.updated_at || skill.created_at || "") >= since);
  }
  if (args.q) {
    const query = words2(args.q);
    skills = skills.map((skill) => ({
      ...skill,
      score: overlap(query, words2([skill.name, skill.description, skill.state].join(" ")))
    })).filter((skill) => skill.score > 0).sort((a, b) => b.score - a.score);
  }
  return { count: skills.length, skills: skills.slice(0, limit).map((skill) => pickFields4(skill, args.fields)) };
}
async function handleSkillIndex(args = {}) {
  return args.mode === "rebuild" ? rebuildSkillIndex() : querySkillIndex(args);
}

// plugins/foundry/src/core/governance.ts
var RESOLUTIONS = ["KEEP", "EVOLVE", "MERGE", "DEPRECATE", "RETIRE"];
var DESTRUCTIVE = new Set(["MERGE", "DEPRECATE", "RETIRE"]);
function isRecord7(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function arrayOfStrings(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}
function skillName(skill) {
  return typeof skill.name === "string" ? skill.name : "";
}
async function skillsForGovernance() {
  return (await readSkillMetadata()).filter(isRecord7);
}
function words3(value) {
  return new Set(String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean));
}
function overlap2(left, right) {
  if (!left.size || !right.size)
    return 0;
  let shared = 0;
  for (const token of left)
    if (right.has(token))
      shared += 1;
  return shared / new Set([...left, ...right]).size;
}
function skillText(skill) {
  return [skill.name, skill.description, ...arrayOfStrings(skill.tags)].join(" ");
}
function successRate(skill) {
  return skill.usage_count ? (skill.success_count || 0) / skill.usage_count : null;
}
async function skillRecord(name) {
  const skillName2 = safeName(name, "name");
  const file = path13.join(await knowledgeDirPath("skills"), skillName2, "skill.json");
  const meta = await readJson(file);
  if (!isRecord7(meta))
    throw Error("Skill not found");
  return { file, meta };
}
function finding(type, skill, reason, extra = {}) {
  return { type, skill: skill.name, reason, ...extra };
}
async function handleGovernanceScan(args = {}) {
  const limit = listLimit(args.limit);
  const nowMs = Date.now();
  const staleDays = args.stale_days === undefined ? 90 : Number(args.stale_days);
  const skills = await skillsForGovernance();
  const findings = [];
  for (const skill of skills) {
    if (!skill.usage_count)
      findings.push(finding("unused", skill, "Skill has no recorded usage."));
    const rate = successRate(skill);
    if (rate !== null && (skill.usage_count || 0) >= 2 && rate < (Number(args.min_success_rate) || 0.5)) {
      findings.push(finding("low-success", skill, "Skill success rate is below threshold.", { success_rate: rate }));
    }
    if (skill.superseded_by)
      findings.push(finding("superseded", skill, `Skill is superseded by ${skill.superseded_by}.`));
    const timestamp = Date.parse(skill.last_used_at || skill.updated_at || skill.created_at || "");
    if (timestamp && nowMs - timestamp > staleDays * 24 * 60 * 60 * 1000) {
      findings.push(finding("stale", skill, "Skill has not been updated or used recently."));
    }
  }
  for (let left = 0;left < skills.length; left += 1) {
    for (let right = left + 1;right < skills.length; right += 1) {
      const leftSkill = skills[left];
      const rightSkill = skills[right];
      if (!leftSkill || !rightSkill)
        continue;
      const score = overlap2(words3(skillText(leftSkill)), words3(skillText(rightSkill)));
      if (score >= (Number(args.duplicate_threshold) || 0.6)) {
        findings.push(finding("duplicate", leftSkill, "Skill metadata overlaps another Skill.", {
          duplicate_of: rightSkill.name,
          score
        }));
      }
    }
  }
  return { count: findings.length, findings: findings.slice(0, limit) };
}
function addGraph(meta, field, value) {
  if (!value)
    return;
  meta[field] = [...new Set([...arrayOfStrings(meta[field]), value])];
}
function requireAction(value) {
  if (typeof value !== "string" || !RESOLUTIONS.includes(value)) {
    throw Error("action must be KEEP, EVOLVE, MERGE, DEPRECATE, or RETIRE");
  }
  return value;
}
async function handleGovernanceResolve(args = {}) {
  return withKnowledgeLock("skills", () => resolveGovernance(args));
}
async function resolveGovernance(args = {}) {
  const action = requireAction(args.action);
  const config = await loadConfig();
  if (DESTRUCTIVE.has(action) && config.maintainer !== (args.actor || "codex")) {
    throw Error("Only the configured Maintainer can apply destructive governance actions");
  }
  const { file, meta } = await skillRecord(args.skill);
  meta.governance_status = action;
  meta.governance_reason = args.reason || "";
  if (action === "MERGE") {
    const target = safeName(args.target_skill, "target_skill");
    const targetRecord = await skillRecord(target);
    meta.state = "MERGED";
    meta.superseded_by = target;
    addGraph(meta, "related_to", target);
    addGraph(targetRecord.meta, "supersedes", skillName(meta));
    await writeJson(targetRecord.file, targetRecord.meta);
  }
  if (action === "DEPRECATE")
    meta.state = "DEPRECATED";
  if (action === "RETIRE")
    meta.state = "RETIRED";
  if (args.related_to)
    addGraph(meta, "related_to", args.related_to);
  if (args.depends_on)
    addGraph(meta, "depends_on", args.depends_on);
  if (args.conflicts_with)
    addGraph(meta, "conflicts_with", args.conflicts_with);
  await writeJson(file, meta);
  await rebuildSkillIndex();
  const result = { action, skill: meta.name, target_skill: args.target_skill || null, state: meta.state };
  await writeEvent("GovernanceResolved", result);
  return result;
}
async function handleSkillGraphValidate() {
  const skills = await skillsForGovernance();
  const names = new Set(skills.map((skill) => skill.name));
  const issues = [];
  for (const skill of skills) {
    for (const field of ["related_to", "depends_on", "supersedes", "conflicts_with"]) {
      for (const target of arrayOfStrings(skill[field])) {
        if (!names.has(target))
          issues.push({ skill: skill.name, field, target, issue: "missing_skill" });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}

// plugins/foundry/src/core/hub.ts
import fs11 from "node:fs/promises";
import path15 from "node:path";

// plugins/foundry/src/core/migration.ts
import fs10 from "node:fs/promises";
import path14 from "node:path";
function isRecord8(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function needsMigration(config) {
  return Number(config?.hub_schema_version || config?.version || 1) < HUB_SCHEMA_VERSION;
}
async function countJsonFiles(home, dir) {
  const root = path14.join(home, dir);
  let count = 0;
  for (const file of await fs10.readdir(root).catch(() => [])) {
    if (file.endsWith(".json"))
      count += 1;
  }
  return count;
}
async function backupHub(home) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path14.join(home, "backups", `migration-v1-to-v2-${stamp}`);
  await fs10.mkdir(backup, { recursive: true });
  for (const dir of DIRS) {
    if (dir === "backups")
      continue;
    await fs10.cp(path14.join(home, dir), path14.join(backup, dir), { recursive: true, force: true }).catch(() => {});
  }
  await fs10.cp(path14.join(anchorHome, "config.json"), path14.join(backup, "config.json"), { force: true });
  return backup;
}
async function ensureKnowledgeDirs(home) {
  await Promise.all(KNOWLEDGE_DIRS.map((dir) => fs10.mkdir(path14.join(home, dir), { recursive: true })));
}
async function restoreHub(home, backup) {
  for (const dir of DIRS) {
    if (dir === "backups")
      continue;
    await fs10.rm(path14.join(home, dir), { recursive: true, force: true });
    await fs10.cp(path14.join(backup, dir), path14.join(home, dir), { recursive: true, force: true }).catch(() => {});
  }
  await fs10.cp(path14.join(backup, "config.json"), path14.join(anchorHome, "config.json"), { force: true });
}
async function migrateActivities(home) {
  const root = path14.join(home, "activities");
  let count = 0;
  for (const file of await fs10.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path14.join(root, file));
    if (!isRecord8(item))
      continue;
    item.schema_version = ACTIVITY_SCHEMA_VERSION;
    item.state ||= "NEW";
    item.recent_updates ||= item.updates || [];
    delete item.updates;
    item.history ||= {
      update_count: Array.isArray(item.recent_updates) ? item.recent_updates.length : 0,
      first_seen: item.started_at || item.created_at || null,
      last_seen: item.updated_at || null,
      key_points: item.key_points || [],
      segments: []
    };
    await writeJson(path14.join(root, file), item);
    count += 1;
  }
  return count;
}
async function migrateCandidates(home) {
  const root = path14.join(home, "candidates");
  let count = 0;
  for (const file of await fs10.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path14.join(root, file));
    if (!isRecord8(item))
      continue;
    item.schema_version = CANDIDATE_SCHEMA_VERSION;
    item.domain ||= null;
    item.topic ||= null;
    item.tags ||= [];
    item.technologies ||= [];
    item.fingerprint ||= null;
    item.occurrences ||= Array.isArray(item.evidence) ? item.evidence.length || 1 : 1;
    item.confidence ??= null;
    const evidenceItems = Array.isArray(item.evidence) ? item.evidence : [];
    item.evidence = evidenceItems.map((evidence) => typeof evidence === "string" ? { activity_id: evidence, reason: "" } : evidence);
    item.resolution ||= null;
    item.resolution_reason ||= "";
    item.merge_target ||= null;
    item.state ||= "OPEN";
    item.updated_at ||= item.created_at || new Date().toISOString();
    await writeJson(path14.join(root, file), item);
    count += 1;
  }
  return count;
}
async function migrateSkills(home) {
  const root = path14.join(home, "skills");
  let count = 0;
  for (const dir of await fs10.readdir(root).catch(() => [])) {
    const file = path14.join(root, dir, "skill.json");
    const item = await readJson(file);
    if (!isRecord8(item))
      continue;
    item.schema_version = SKILL_METADATA_SCHEMA_VERSION;
    item.source_candidate ??= null;
    item.state ||= "DRAFT";
    item.revision ||= 0;
    item.updated_at ||= item.created_at || new Date().toISOString();
    await writeJson(file, item);
    count += 1;
  }
  return count;
}
function unique2(values) {
  return [...new Set(values.filter(Boolean))];
}
function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
async function sourceHomes(hostHome) {
  const sources = await describeActivitySources();
  return [
    ...new Set([hostHome, ...sources.map((source) => source.root).filter((root) => Boolean(root))])
  ];
}
async function migratePatternsFromSource(source, target) {
  const sourceFile = path14.join(source, "indexes", "patterns.json");
  const sourceIndex = await readJson(sourceFile);
  if (!Array.isArray(sourceIndex?.patterns))
    return 0;
  const targetFile = path14.join(target, "indexes", "patterns.json");
  const targetIndex = await readJson(targetFile) || { schema_version: 1, patterns: [] };
  targetIndex.patterns = Array.isArray(targetIndex.patterns) ? targetIndex.patterns : [];
  let migrated = 0;
  for (const sourcePattern of sourceIndex.patterns) {
    if (!isRecord8(sourcePattern) || typeof sourcePattern.fingerprint !== "string")
      continue;
    let targetPattern = targetIndex.patterns.find((item) => item.fingerprint === sourcePattern.fingerprint);
    if (!targetPattern) {
      targetIndex.patterns.push(sourcePattern);
      migrated += 1;
      continue;
    }
    const refs = [...Array.isArray(targetPattern.activity_refs) ? targetPattern.activity_refs : []];
    for (const id of Array.isArray(sourcePattern.activity_ids) ? sourcePattern.activity_ids : []) {
      refs.push({ source: path14.basename(path14.dirname(source)), id });
    }
    targetPattern.activity_refs = unique2([
      ...refs.map((ref) => isRecord8(ref) ? `${ref.source}:${ref.id}` : null),
      ...Array.isArray(sourcePattern.activity_refs) ? sourcePattern.activity_refs.map((ref) => isRecord8(ref) ? `${ref.source}:${ref.id}` : null) : []
    ]).map((ref) => {
      const [sourceId, id] = String(ref).split(":");
      return { source: sourceId, id };
    });
    targetPattern.activity_ids = unique2([
      ...Array.isArray(targetPattern.activity_ids) ? targetPattern.activity_ids : [],
      ...Array.isArray(sourcePattern.activity_ids) ? sourcePattern.activity_ids : []
    ]);
    targetPattern.source_hosts = unique2([
      ...Array.isArray(targetPattern.source_hosts) ? targetPattern.source_hosts : [],
      ...Array.isArray(sourcePattern.source_hosts) ? sourcePattern.source_hosts : []
    ]);
    targetPattern.project_ids = unique2([
      ...Array.isArray(targetPattern.project_ids) ? targetPattern.project_ids : [],
      ...Array.isArray(sourcePattern.project_ids) ? sourcePattern.project_ids : []
    ]);
    targetPattern.occurrences = Array.isArray(targetPattern.activity_refs) ? targetPattern.activity_refs.length : Array.isArray(targetPattern.activity_ids) ? targetPattern.activity_ids.length : 0;
    targetPattern.projects = Array.isArray(targetPattern.project_ids) ? targetPattern.project_ids.length : 0;
    targetPattern.first_seen = [targetPattern.first_seen, sourcePattern.first_seen].filter((value) => typeof value === "string").sort()[0] || null;
    targetPattern.last_seen = [targetPattern.last_seen, sourcePattern.last_seen].filter((value) => typeof value === "string").sort().at(-1) || null;
    targetPattern.high_value = Boolean(targetPattern.high_value || sourcePattern.high_value);
    migrated += 1;
  }
  await writeJson(targetFile, { schema_version: 1, patterns: targetIndex.patterns });
  return migrated;
}
async function migrateCandidatesFromSource(source, target, conflicts) {
  const sourceDir = path14.join(source, "candidates");
  const targetDir = path14.join(target, "candidates");
  let migrated = 0;
  for (const file of await fs10.readdir(sourceDir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const candidate = await readJson(path14.join(sourceDir, file));
    if (!isRecord8(candidate))
      continue;
    const targetFile = path14.join(targetDir, file);
    const existing = await readJson(targetFile);
    if (!existing) {
      await writeJson(targetFile, candidate);
      migrated += 1;
      continue;
    }
    if (!sameJson(existing, candidate)) {
      conflicts.push({
        type: "candidate",
        source,
        id: String(candidate.id || file),
        recommended_resolution: "review duplicate candidate before merging"
      });
    }
  }
  return migrated;
}
async function migrateSkillsFromSource(source, target, conflicts) {
  const sourceDir = path14.join(source, "skills");
  const targetDir = path14.join(target, "skills");
  let migrated = 0;
  for (const dir of await fs10.readdir(sourceDir).catch(() => [])) {
    const sourceSkill = path14.join(sourceDir, dir);
    const targetSkill = path14.join(targetDir, dir);
    const sourceMeta = await readJson(path14.join(sourceSkill, "skill.json"));
    if (!isRecord8(sourceMeta))
      continue;
    const targetMeta = await readJson(path14.join(targetSkill, "skill.json"));
    if (!targetMeta) {
      await fs10.cp(sourceSkill, targetSkill, { recursive: true, force: false });
      migrated += 1;
      continue;
    }
    const sourceContent = await fs10.readFile(path14.join(sourceSkill, "SKILL.md"), "utf8").catch(() => "");
    const targetContent = await fs10.readFile(path14.join(targetSkill, "SKILL.md"), "utf8").catch(() => "");
    if (sameJson(targetMeta, sourceMeta) || sourceContent === targetContent)
      continue;
    conflicts.push({
      type: "skill",
      source,
      id: dir,
      recommended_resolution: "manual merge required; target skill was not overwritten"
    });
  }
  return migrated;
}
async function migrateSharedKnowledge(hostHome) {
  const knowledgeHome2 = await resolveKnowledgeHome();
  await ensureKnowledgeDirs(knowledgeHome2);
  const conflicts = [];
  const migrated = { patterns: 0, candidates: 0, skills: 0 };
  const sources = (await sourceHomes(hostHome)).filter((source) => path14.resolve(source) !== path14.resolve(knowledgeHome2));
  for (const source of sources) {
    migrated.patterns += await migratePatternsFromSource(source, knowledgeHome2);
    migrated.candidates += await migrateCandidatesFromSource(source, knowledgeHome2, conflicts);
    migrated.skills += await migrateSkillsFromSource(source, knowledgeHome2, conflicts);
  }
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    sources,
    migrated,
    conflicts
  };
  await writeJson(path14.join(await knowledgeDirPath("indexes"), "migration-report.json"), report);
  return report;
}
async function migrationStatus() {
  const config = await loadConfig();
  const home = await resolveHome(config);
  const knowledge = await resolveKnowledgeHome();
  return {
    migration_required: needsMigration(config),
    from_schema_version: Number(config.hub_schema_version || config.version || 1),
    to_schema_version: HUB_SCHEMA_VERSION,
    hub: home,
    data_path: home,
    knowledge_path: knowledge,
    config_path: path14.join(anchorHome, "config.json")
  };
}
async function handleHubMigrate(args = {}) {
  const status = await migrationStatus();
  const counts = {
    activities: await countJsonFiles(status.hub, "activities"),
    candidates: await countJsonFiles(status.knowledge_path, "candidates"),
    skills: (await fs10.readdir(path14.join(status.knowledge_path, "skills")).catch(() => [])).length
  };
  if (!status.migration_required)
    return { ...status, dry_run: Boolean(args.dry_run), migrated: false, counts };
  if (args.dry_run || args.confirm !== true) {
    return { ...status, dry_run: true, migrated: false, counts, action: "confirm_required" };
  }
  const backup = await backupHub(status.hub);
  try {
    const shared_knowledge = await migrateSharedKnowledge(status.hub);
    const migrated = {
      activities: await migrateActivities(status.hub),
      candidates: await migrateCandidates(status.knowledge_path),
      skills: await migrateSkills(status.knowledge_path)
    };
    const config = await loadConfig();
    await saveConfig({ ...config, version: HUB_SCHEMA_VERSION, hub_schema_version: HUB_SCHEMA_VERSION });
    const result = { ...status, migration_required: false, migrated: true, backup, counts: migrated, shared_knowledge };
    await writeEvent("HubMigrated", result);
    return result;
  } catch (err) {
    await restoreHub(status.hub, backup);
    await writeEvent("HubMigrationFailed", {
      ...status,
      backup,
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
}

// plugins/foundry/src/core/hub.ts
function isRecord9(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function handleHubInit(args = {}) {
  const config = await loadConfig();
  if ((config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION) {
    return { ...await migrationStatus(), initialized: false, action: "migration_required" };
  }
  if (args.maintainer !== undefined) {
    config.maintainer = args.maintainer;
  }
  if (args.automation_policy !== undefined) {
    if (!AUTOMATION_POLICIES.includes(args.automation_policy)) {
      throw Error("invalid automation_policy");
    }
    config.automation_policy = args.automation_policy;
  }
  const saved = await saveConfig(config);
  const home = await resolveHostHome(saved);
  const knowledge = await resolveKnowledgeHome();
  await fs11.mkdir(home, { recursive: true });
  await fs11.mkdir(knowledge, { recursive: true });
  await Promise.all([
    ...HOST_DIRS.map((dir) => fs11.mkdir(path15.join(home, dir), { recursive: true })),
    ...KNOWLEDGE_DIRS.map((dir) => fs11.mkdir(path15.join(knowledge, dir), { recursive: true }))
  ]);
  return {
    initialized: true,
    hub: home,
    data_path: home,
    knowledge_path: knowledge,
    config_path: path15.join(anchorHome, "config.json"),
    hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION,
    maintainer: saved.maintainer,
    automation_policy: saved.automation_policy
  };
}
async function handleHubConfig(args = {}) {
  const config = await loadConfig();
  const oldHome = await resolveHome(config);
  const newHome = args.path !== undefined ? path15.resolve(args.path) : oldHome;
  if (args.maintainer !== undefined) {
    config.maintainer = args.maintainer;
  }
  if (args.automation_policy !== undefined) {
    if (!AUTOMATION_POLICIES.includes(args.automation_policy)) {
      throw Error("invalid automation_policy");
    }
    config.automation_policy = args.automation_policy;
  }
  let movedFrom = null;
  if (args.path !== undefined && newHome !== oldHome) {
    movedFrom = oldHome;
    await fs11.mkdir(newHome, { recursive: true });
    for (const dir of DIRS) {
      const src = path15.join(oldHome, dir);
      const dst = path15.join(newHome, dir);
      await fs11.mkdir(dst, { recursive: true });
      for (const entry of await fs11.readdir(src).catch(() => [])) {
        await fs11.rename(path15.join(src, entry), path15.join(dst, entry));
      }
      await fs11.rm(src, { recursive: true, force: true });
    }
    config.hub_path = newHome;
  }
  const saved = await saveConfig(config);
  if (movedFrom) {
    return {
      ...saved,
      hub: newHome,
      data_path: newHome,
      moved_from: movedFrom,
      config_path: path15.join(anchorHome, "config.json"),
      hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION
    };
  }
  return {
    ...saved,
    hub: await resolveHome(saved),
    data_path: await resolveHome(saved),
    config_path: path15.join(anchorHome, "config.json"),
    hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION
  };
}
async function handleHubStatus() {
  const config = await loadConfig();
  const home = await resolveHostHome(config);
  const knowledge = await resolveKnowledgeHome();
  const hostCount = async (dir) => (await fs11.readdir(await hostDirPath(dir)).catch(() => [])).length;
  const knowledgeCount = async (dir) => (await fs11.readdir(await knowledgeDirPath(dir)).catch(() => [])).length;
  const locations = await dataLocations();
  const activities = await hostCount("activities");
  const candidates = await knowledgeCount("candidates");
  const skills = await knowledgeCount("skills");
  const nextAction = activities === 0 ? "capture_activity" : candidates === 0 ? "create_candidate" : skills === 0 ? "create_skill" : "review_or_cleanup";
  return {
    hub: home,
    data_path: home,
    knowledge_path: knowledge,
    config_path: path15.join(anchorHome, "config.json"),
    config,
    hub_schema_version: config.hub_schema_version || HUB_SCHEMA_VERSION,
    migration_required: (config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION,
    activities,
    candidates,
    skills,
    locations,
    next_action: nextAction
  };
}
async function dataLocations() {
  const practiceRoot = await resolveHostHome();
  const knowledgeRoot = await resolveKnowledgeHome();
  return {
    host: currentHost(),
    practice: {
      root: practiceRoot,
      sessions: await hostDirPath("sessions"),
      activities: await hostDirPath("activities"),
      archive: await hostDirPath("archive")
    },
    knowledge: {
      root: knowledgeRoot,
      patterns: path15.join(await knowledgeDirPath("indexes"), "patterns.json"),
      candidates: await knowledgeDirPath("candidates"),
      skills: await knowledgeDirPath("skills"),
      indexes: await knowledgeDirPath("indexes"),
      events: await knowledgeDirPath("events"),
      usage: await knowledgeDirPath("usage"),
      backups: await knowledgeDirPath("backups")
    },
    resolution: {
      host_home_source: hostHomeSource,
      knowledge_home_source: _knowledgeHomeSource,
      knowledge_home_source_key: _knowledgeHomeSource === "environment" ? "USORA_HOME" : null
    },
    activity_sources: await describeActivitySources()
  };
}
async function handleHubCleanup(args = {}) {
  const mode = args.mode || "generated";
  if (!["generated", "all"].includes(mode)) {
    throw Error("mode must be generated or all");
  }
  if (mode === "all") {
    if (args.confirm !== true) {
      throw Error("all cleanup requires confirm=true");
    }
    return cleanAll();
  }
  return archiveGenerated();
}
async function cleanAll() {
  const home = await resolveHome();
  const counts = {};
  for (const dir of DIRS) {
    const target = path15.join(home, dir);
    const files = await fs11.readdir(target).catch(() => []);
    counts[dir] = files.length;
    await fs11.rm(target, { recursive: true, force: true });
    await fs11.mkdir(target, { recursive: true });
  }
  return {
    mode: "all",
    counts,
    hub: home,
    data_path: home,
    config_path: path15.join(anchorHome, "config.json"),
    action: "deleted_all_hub_data"
  };
}
async function archiveGenerated() {
  let archived = 0;
  const activitiesDir = await hostDirPath("activities");
  const archiveDir = await hostDirPath("archive");
  for (const file of await fs11.readdir(activitiesDir)) {
    if (!file.endsWith(".json"))
      continue;
    const source = path15.join(activitiesDir, file);
    const item = await readJson(source);
    if (isRecord9(item) && (ARCHIVABLE_STATES.includes(String(item.state)) || item.skill_id)) {
      await fs11.rename(source, path15.join(archiveDir, file));
      archived++;
    }
  }
  return { mode: "generated", archived, action: "archived_generated_activities" };
}
async function handleHubDoctor() {
  const config = await loadConfig();
  const home = await resolveHome(config);
  const counts = {};
  const checks = [];
  for (const dir of DIRS) {
    const target = path15.join(home, dir);
    try {
      counts[dir] = (await fs11.readdir(target)).length;
      checks.push({ name: `${dir}_dir`, ok: true, path: target });
    } catch (err) {
      counts[dir] = 0;
      checks.push({
        name: `${dir}_dir`,
        ok: false,
        path: target,
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }
  const skillDirs = await fs11.readdir(path15.join(home, "skills")).catch(() => []);
  const orphanSkills = [];
  for (const dir of skillDirs) {
    const meta = await readJson(path15.join(home, "skills", dir, "skill.json"));
    if (!meta)
      orphanSkills.push(dir);
  }
  checks.push({ name: "skill_metadata", ok: orphanSkills.length === 0, orphan_skills: orphanSkills });
  return {
    ok: checks.every((check) => check.ok),
    hub: home,
    data_path: home,
    config_path: path15.join(anchorHome, "config.json"),
    hub_schema_version: config.hub_schema_version || HUB_SCHEMA_VERSION,
    migration_required: (config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION,
    config,
    counts,
    checks
  };
}

// plugins/foundry/src/core/hub-query.ts
import fs12 from "node:fs/promises";
import path16 from "node:path";
var COLLECTIONS = ["activities", "sessions", "events", "candidates", "skills", "indexes"];
function isRecord10(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function collection(value) {
  if (typeof value !== "string" || !COLLECTIONS.includes(value)) {
    throw Error(`collection must be one of: ${COLLECTIONS.join(", ")}`);
  }
  return value;
}
function pickFields5(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0)
    return item;
  return Object.fromEntries(fields.filter((field) => typeof field === "string" && (field in item)).map((field) => [field, item[field]]));
}
async function hostRoots(host) {
  const seen = new Set;
  const result = [];
  for (const source of await describeActivitySources()) {
    if (source.host !== host || !source.root)
      continue;
    const key = path16.resolve(source.root).toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    result.push({ id: source.id, host: source.host, root: source.root });
  }
  return result;
}
async function readJsonDir(dir, fields) {
  const items = [];
  for (const file of await fs12.readdir(dir).catch(() => [])) {
    if (!file.endsWith(".json"))
      continue;
    const item = await readJson(path16.join(dir, file));
    if (isRecord10(item))
      items.push(pickFields5({ ...item, file }, fields));
  }
  return items;
}
async function readSkills2(dir, fields) {
  const items = [];
  for (const entry of await fs12.readdir(dir).catch(() => [])) {
    const item = await readJson(path16.join(dir, entry, "skill.json"));
    if (isRecord10(item))
      items.push(pickFields5({ ...item, dir: entry }, fields));
  }
  return items;
}
async function readCollection(root, name, fields) {
  const dir = path16.join(root, name);
  return name === "skills" ? readSkills2(dir, fields) : readJsonDir(dir, fields);
}
async function handleHubQuery(args = {}) {
  const host = safeName(args.host || "codex", "host");
  const name = collection(args.collection || "activities");
  const limit = listLimit(args.limit);
  const roots = await hostRoots(host);
  if (roots.length === 0)
    return { host, collection: name, available: false, count: 0, records: [] };
  const records = [];
  for (const root of roots) {
    for (const item of await readCollection(root.root, name, args.fields)) {
      records.push({ source: root.id, host: root.host, root: root.root, ...item });
    }
  }
  records.sort((a, b) => String(b.updated_at || b.timestamp || b.created_at || "").localeCompare(String(a.updated_at || a.timestamp || a.created_at || "")));
  return { host, collection: name, available: true, count: records.length, records: records.slice(0, limit) };
}

// plugins/foundry/src/core/cache.ts
import fs13 from "node:fs/promises";
import path17 from "node:path";
import os3 from "node:os";
import { fileURLToPath as fileURLToPath2 } from "node:url";
async function handlePluginCacheCleanup(args = {}) {
  const pluginRoot = path17.resolve(path17.dirname(fileURLToPath2(import.meta.url)), "../..");
  const cacheRoot = path17.dirname(pluginRoot);
  const currentVersion = path17.basename(pluginRoot);
  const home = path17.resolve(os3.homedir()).toLowerCase();
  const normalizedPluginRoot = path17.resolve(pluginRoot).toLowerCase();
  const isKnownHostCache = normalizedPluginRoot.startsWith(home) && (normalizedPluginRoot.includes(`${path17.sep}.codex${path17.sep}`) || normalizedPluginRoot.includes(`${path17.sep}.codebuddy${path17.sep}`)) && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(currentVersion);
  if (!isKnownHostCache) {
    return {
      ok: false,
      action: "not_installed_cache",
      message: "Usora is not running from a versioned Codex or CodeBuddy installed plugin cache. Install or upgrade Usora first, then clean old caches.",
      plugin_root: pluginRoot
    };
  }
  const oldCaches = [];
  for (const entry of await fs13.readdir(cacheRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || entry.name === currentVersion)
      continue;
    const fullPath = path17.join(cacheRoot, entry.name);
    if (!isInside2(cacheRoot, fullPath)) {
      throw Error(`Refusing to inspect path outside Usora plugin cache: ${fullPath}`);
    }
    oldCaches.push({ version: entry.name, path: fullPath });
  }
  if (args.confirm !== true) {
    return {
      ok: true,
      dry_run: true,
      action: "preview_old_plugin_caches",
      current_version: currentVersion,
      cache_root: cacheRoot,
      old_caches: oldCaches,
      deleted: 0
    };
  }
  for (const cache of oldCaches) {
    if (!isInside2(cacheRoot, cache.path)) {
      throw Error(`Refusing to delete path outside Usora plugin cache: ${cache.path}`);
    }
    await fs13.rm(cache.path, { recursive: true, force: true });
  }
  return {
    ok: true,
    dry_run: false,
    action: "deleted_old_plugin_caches",
    current_version: currentVersion,
    cache_root: cacheRoot,
    old_caches: oldCaches,
    deleted: oldCaches.length
  };
}

// plugins/foundry/src/core/skills.ts
import fs14 from "node:fs/promises";
import path18 from "node:path";
function isRecord11(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function asArray2(value) {
  return Array.isArray(value) ? value : [];
}
function asRecords(value) {
  return asArray2(value).filter(isRecord11);
}
function stringValue(value) {
  return typeof value === "string" ? value : undefined;
}
function numberValue2(value) {
  return typeof value === "number" ? value : 0;
}
async function readCandidate(id) {
  return readJson(path18.join(await knowledgeDirPath("candidates"), `${safeName(id, "candidate_id")}.json`));
}
async function requirePassingCandidate(candidateId) {
  if (!candidateId)
    throw Error("candidate_id is required");
  const candidate = await readCandidate(candidateId);
  if (!isRecord11(candidate))
    throw Error("Candidate not found");
  if (candidate.state !== "EVALUATED" || candidate.evaluation?.result !== "pass") {
    throw Error("Skill requires a passing Candidate evaluation");
  }
  return candidate;
}
async function readSkillMeta(name) {
  const skillName2 = safeName(name, "name");
  const file = path18.join(await knowledgeDirPath("skills"), skillName2, "skill.json");
  const meta = await readJson(file);
  if (!isRecord11(meta))
    throw Error("Skill not found");
  return { skillName: skillName2, file, meta, dir: path18.dirname(file) };
}
function generatedSkillName(candidate, fallback = "generated-skill") {
  const slug = String(candidate.title || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  return slug || fallback;
}
function generatedSkillContent(candidate, similarSkills) {
  const evidence = asRecords(candidate.evidence).slice(0, 3).map((item) => `- ${item.activity_id || item.id || "evidence"}${item.reason ? `: ${item.reason}` : ""}`).join(`
`);
  const similar = similarSkills.slice(0, 3).map((skill) => `- ${skill.name}: ${skill.description || skill.state || "metadata only"}`).join(`
`);
  return [
    `# ${candidate.title}`,
    "",
    "## When To Use",
    candidate.summary,
    "",
    "## Evidence",
    evidence || "- No evidence refs provided.",
    "",
    "## Similar Skills Checked",
    similar || "- No similar Skill metadata found.",
    ""
  ].join(`
`);
}
async function handleSkillCreate(args) {
  return withKnowledgeLock("skills", () => createSkill(args));
}
async function createSkill(args) {
  if (!args.name || !args.content) {
    throw Error("name and content are required");
  }
  if (args.candidate_id)
    await requirePassingCandidate(args.candidate_id);
  const skillName2 = safeName(args.name, "name");
  const dir = path18.join(await knowledgeDirPath("skills"), skillName2);
  await fs14.mkdir(dir, { recursive: true });
  const meta = {
    schema_version: SKILL_METADATA_SCHEMA_VERSION,
    name: skillName2,
    description: args.description || "",
    content: args.content,
    source_candidate: args.candidate_id || null,
    generation: args.generation || null,
    state: "DRAFT",
    revision: 0,
    created_at: now(),
    updated_at: now()
  };
  await writeJson(path18.join(dir, "skill.json"), meta);
  const content = args.content.endsWith(`
`) ? args.content : `${args.content}
`;
  await fs14.writeFile(path18.join(dir, "SKILL.md"), content, "utf8");
  await rebuildSkillIndex();
  await writeEvent("SkillDraftCreated", meta);
  return meta;
}
async function handleSkillGenerate(args = {}) {
  return withKnowledgeLock("skills", () => generateSkill(args));
}
async function generateSkill(args = {}) {
  const started = Date.now();
  const candidate = await requirePassingCandidate(args.candidate_id);
  const similar = await querySkillIndex({
    q: [candidate.title, candidate.summary, ...asArray2(candidate.technologies)].join(" "),
    limit: 3
  });
  const similarSkills = similar.skills;
  const content = generatedSkillContent(candidate, similarSkills);
  const generation = {
    source: "candidate_spec",
    evidence_loaded: Math.min(asArray2(candidate.evidence).length, 3),
    skills_loaded: similarSkills.length,
    full_activity_load: false,
    full_skill_load: false
  };
  const budget = await checkContextBudget("skill_compiler", {
    required: { candidate: { ...candidate, evidence: asArray2(candidate.evidence).slice(0, 3) } },
    recommended: { similar_skills: similarSkills.slice(0, 3) },
    optional: {}
  });
  const skillArgs = {
    name: args.name || generatedSkillName(candidate),
    description: args.description || stringValue(candidate.summary),
    content,
    candidate_id: candidate.id,
    generation
  };
  const skill = await handleSkillCreate(skillArgs);
  await recordIntelligenceRun({
    stage: "skill_compiler",
    input: {
      candidate: { ...candidate, evidence: asArray2(candidate.evidence).slice(0, 3) },
      similar_skills: similarSkills
    },
    output: skill,
    evidence_loaded: generation.evidence_loaded,
    skills_loaded: generation.skills_loaded,
    full_activity_load: false,
    full_skill_load: false,
    cache_hit: false,
    duration_ms: Date.now() - started,
    budget
  });
  return skill;
}
function skillDelta(args, candidate, action) {
  return {
    schema_version: 1,
    action,
    reason: args.reason || "",
    evidence: asArray2(args.evidence || candidate?.evidence).slice(0, 3),
    source_candidate: candidate?.id || args.candidate_id || null,
    source_pattern: args.pattern_fingerprint || candidate?.fingerprint || null,
    changes: isRecord11(args.changes) ? args.changes : {},
    target_skill: args.target_skill || null,
    created_at: now()
  };
}
async function patchSkill(name, delta) {
  const { file, meta, dir } = await readSkillMeta(name);
  const current = await fs14.readFile(path18.join(dir, "SKILL.md"), "utf8").catch(() => meta.content || "");
  const append = typeof delta.changes.content_append === "string" ? delta.changes.content_append : "";
  const nextContent = typeof delta.changes.content === "string" ? delta.changes.content : append ? `${current.trimEnd()}

${append.trim()}
` : current;
  meta.content = nextContent;
  meta.description = stringValue(delta.changes.description) || meta.description;
  meta.source_candidate = delta.source_candidate || meta.source_candidate || null;
  meta.source_patterns = [...new Set([...asArray2(meta.source_patterns), delta.source_pattern].filter(Boolean))];
  meta.revision = numberValue2(meta.revision) + 1;
  meta.updated_at = now();
  meta.evolution = [...meta.evolution || [], delta].slice(-20);
  await writeJson(file, meta);
  await fs14.writeFile(path18.join(dir, "SKILL.md"), nextContent.endsWith(`
`) ? nextContent : `${nextContent}
`, "utf8");
  await rebuildSkillIndex();
  await writeEvent("SkillEvolved", { name: meta.name, revision: meta.revision, delta });
  return meta;
}
async function handleSkillEvolve(args = {}) {
  return withKnowledgeLock("skills", () => evolveSkill(args));
}
async function evolveSkill(args = {}) {
  if (args.action && !["CREATE", "PATCH", "NOOP", "SPLIT", "MERGE"].includes(args.action)) {
    throw Error("action must be CREATE, PATCH, NOOP, SPLIT, or MERGE");
  }
  const candidate = args.candidate_id ? await requirePassingCandidate(args.candidate_id) : null;
  const action = args.action || null;
  if ((action === "CREATE" || !action && !args.name) && !candidate) {
    throw Error("candidate_id is required to create a Skill evolution");
  }
  if (action === "CREATE")
    return handleSkillGenerate(args);
  const similar = candidate ? await querySkillIndex({
    q: [candidate.title, candidate.summary, ...asArray2(candidate.technologies)].join(" "),
    limit: 3
  }) : { skills: [] };
  const target = args.name || similar.skills[0]?.name;
  const resolvedAction = action || (target && (similar.skills[0]?.score || 0) >= (Number(args.threshold) || 0.2) ? "PATCH" : "CREATE");
  if (resolvedAction === "CREATE")
    return handleSkillGenerate({ ...args, candidate_id: candidate?.id || args.candidate_id });
  const delta = skillDelta(args, candidate, resolvedAction);
  if (resolvedAction === "PATCH") {
    if (!target)
      throw Error("name is required for PATCH");
    const patch = delta.changes.content_append ? delta : {
      ...delta,
      changes: {
        ...delta.changes,
        content_append: `## Evolution
${candidate?.summary || args.reason || "Updated behavior."}`
      }
    };
    return patchSkill(target, patch);
  }
  const result = { action: resolvedAction, target_skill: target || null, delta, similar_skills: similar.skills };
  await writeEvent("SkillEvolutionRecommended", result);
  return result;
}
async function handleSkillEvaluate(args) {
  return withKnowledgeLock("skills", () => evaluateSkill(args));
}
async function evaluateSkill(args) {
  const skillName2 = safeName(args.name, "name");
  const file = path18.join(await knowledgeDirPath("skills"), skillName2, "skill.json");
  const item = await readJson(file);
  if (!isRecord11(item))
    throw Error("Skill not found");
  const result = args.result;
  if (result !== "pass" && result !== "fail") {
    throw Error("result must be pass or fail");
  }
  item.evaluation = {
    result,
    reviewer: args.reviewer || "codex",
    evaluated_at: now(),
    notes: args.notes || ""
  };
  item.state = result === "pass" ? "EVALUATED" : "REJECTED";
  item.updated_at = now();
  await writeJson(file, item);
  await rebuildSkillIndex();
  await writeEvent("SkillEvaluationCompleted", item);
  return item;
}
async function handleSkillPublish(args) {
  return withKnowledgeLock("skills", () => publishSkill(args));
}
async function publishSkill(args) {
  const config = await loadConfig();
  if (config.maintainer !== (args.actor || "codex")) {
    throw Error("Only the configured Maintainer can publish");
  }
  const skillName2 = safeName(args.name, "name");
  const file = path18.join(await knowledgeDirPath("skills"), skillName2, "skill.json");
  const meta = await readJson(file);
  if (!isRecord11(meta))
    throw Error("Skill not found");
  const evaluation = isRecord11(meta.evaluation) ? meta.evaluation : {};
  if (meta.state !== "EVALUATED" || evaluation.result !== "pass") {
    throw Error("Skill requires a passing evaluation");
  }
  meta.revision = numberValue2(meta.revision) + 1;
  meta.state = "PUBLISHED";
  meta.published_at = now();
  meta.updated_at = meta.published_at;
  await writeJson(file, meta);
  await rebuildSkillIndex();
  await writeEvent("SkillPublished", meta);
  return meta;
}
async function handleSkillRead(args) {
  const skillName2 = safeName(args.name, "name");
  const dir = path18.join(await knowledgeDirPath("skills"), skillName2);
  const meta = await readJson(path18.join(dir, "skill.json"));
  if (!isRecord11(meta))
    throw Error("Skill not found");
  const content = await fs14.readFile(path18.join(dir, "SKILL.md"), "utf8").catch(() => meta.content || "");
  const { content: _storedContent, ...metadata } = meta;
  return { metadata, content };
}
async function handleSkillList(args = {}) {
  const limit = listLimit(args.limit);
  const skillsDir = await knowledgeDirPath("skills");
  const items = [];
  for (const dir of await fs14.readdir(skillsDir).catch(() => [])) {
    const meta = await readJson(path18.join(skillsDir, dir, "skill.json"));
    if (!isRecord11(meta))
      continue;
    items.push(skillSummary(meta));
  }
  items.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return { count: items.length, skills: items.slice(0, limit) };
}
async function handleSkillQuery(args = {}) {
  const queryArgs = { limit: args.limit, fields: args.fields };
  const state = stringValue(args.state);
  const candidateId = stringValue(args.candidate_id);
  const q = stringValue(args.q);
  if (state)
    queryArgs.state = state;
  if (candidateId)
    queryArgs.candidate_id = candidateId;
  if (q)
    queryArgs.q = q;
  return querySkillIndex(queryArgs);
}
async function handleSkillGet(args = {}) {
  return handleSkillRead(args);
}

// plugins/foundry/src/core/usage.ts
import path19 from "node:path";
var OUTCOMES = ["success", "partial", "failure", "unknown"];
function isRecord12(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function bump(meta, outcome) {
  meta.usage_count = (meta.usage_count || 0) + 1;
  meta.success_count = (meta.success_count || 0) + (outcome === "success" ? 1 : 0);
  meta.partial_count = (meta.partial_count || 0) + (outcome === "partial" ? 1 : 0);
  meta.failure_count = (meta.failure_count || 0) + (outcome === "failure" ? 1 : 0);
}
async function handleUsageCapture(args = {}) {
  return withKnowledgeLock("skills", () => captureUsage(args));
}
async function captureUsage(args = {}) {
  const skill = safeName(args.skill, "skill");
  const outcome = args.outcome || "unknown";
  if (!OUTCOMES.includes(outcome))
    throw Error("outcome must be success, partial, failure, or unknown");
  const skillFile = path19.join(await knowledgeDirPath("skills"), skill, "skill.json");
  const meta = await readJson(skillFile);
  if (!isRecord12(meta))
    throw Error("Skill not found");
  const usedAt = args.used_at || now();
  const usage = {
    schema_version: 1,
    id: newId("usage"),
    session_id: args.session_id || null,
    skill,
    activity_id: args.activity_id || null,
    outcome,
    validation_evidence: args.validation_evidence || [],
    project: args.project || null,
    used_at: usedAt
  };
  await writeJson(path19.join(await knowledgeDirPath("usage"), `${usage.id}.json`), usage);
  bump(meta, outcome);
  meta.last_used_at = usedAt;
  meta.projects_used = [
    ...new Set([...meta.projects_used || [], args.project].filter((project) => typeof project === "string"))
  ];
  await writeJson(skillFile, meta);
  await rebuildSkillIndex();
  await writeEvent("UsageCaptured", usage);
  return { usage, skill: meta };
}

// plugins/foundry/src/mcp/tools/activity.ts
var activityTools = [
  {
    name: "activity_capture",
    description: "Create or update one Activity for the current MCP process. If session_id is supplied, repeated calls with the same value merge; otherwise the server uses its process-scoped session ID.",
    inputSchema: {
      type: "object",
      required: ["task", "result"],
      properties: {
        session_id: { type: "string" },
        task: { type: "string" },
        summary: { type: "string" },
        result: { type: "string" },
        key_points: { type: "array", items: { type: "string" } },
        context: { type: "string" },
        approach: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        outcome: { type: "string" },
        source: { type: "string" },
        project: { type: "string" },
        metadata: { type: "object" }
      }
    }
  },
  {
    name: "activity_list",
    description: "Deprecated: use activity_query. List recent Activities from the active Hub without loading archives.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "activity_digest_list",
    description: "List compact Activity digests for AI retrieval without full Activity records.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "activity_query",
    description: "Query Activities; defaults to compact digests and only returns full records when projection=full.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        projection: { type: "string", enum: ["digest", "full"] },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "activity_get",
    description: "Read one full Activity record by id; use only when a digest is insufficient.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  }
];

// plugins/foundry/src/mcp/tools/candidate.ts
var candidateTools = [
  {
    name: "context_budget",
    description: "Estimate context size for a Foundry intelligence stage using chars/4 token estimates and emit overflow events when limits are exceeded.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: ["pattern_judge", "candidate_resolver", "skill_compiler", "evaluator"] },
        required: { type: "object" },
        recommended: { type: "object" },
        optional: { type: "object" }
      }
    }
  },
  {
    name: "candidate_create",
    description: "Create a Candidate from an observed reusable pattern; do not create one for a one-off task.",
    inputSchema: {
      type: "object",
      required: ["title", "summary"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        domain: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        occurrences: { type: "number" },
        confidence: { type: "number" },
        evidence: {
          type: "array",
          items: {
            anyOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  activity_id: { type: "string" },
                  reason: { type: "string" }
                }
              }
            ]
          }
        },
        source: { type: "string" }
      }
    }
  },
  {
    name: "candidate_match",
    description: "Return local Candidate and Skill metadata matches without reading Skill content.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "candidate_resolve",
    description: "Resolve a Candidate proposal locally: match an existing Candidate/Skill, create a new Candidate, or drop low-evidence input.",
    inputSchema: {
      type: "object",
      required: ["title", "summary"],
      properties: {
        title: { type: "string" },
        summary: { type: "string" },
        domain: { type: "string" },
        topic: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        fingerprint: { type: "string" },
        pattern_fingerprint: { type: "string" },
        occurrences: { type: "number" },
        confidence: { type: "number" },
        high_value: { type: "boolean" },
        threshold: { type: "number" },
        evidence: {
          type: "array",
          items: {
            anyOf: [
              { type: "string" },
              {
                type: "object",
                properties: {
                  activity_id: { type: "string" },
                  reason: { type: "string" }
                }
              }
            ]
          }
        },
        source: { type: "string" }
      }
    }
  },
  {
    name: "pattern_index",
    description: "Update the local Pattern index from Activity digests. Defaults to incremental NEW Activity indexing.",
    inputSchema: {
      type: "object",
      properties: { mode: { type: "string", enum: ["incremental", "rebuild"] } }
    }
  },
  {
    name: "pattern_query",
    description: "Query local Pattern metadata without loading full Activities.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        eligible: { type: "boolean" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "pattern_get",
    description: "Read one Pattern metadata record by fingerprint.",
    inputSchema: {
      type: "object",
      required: ["fingerprint"],
      properties: {
        fingerprint: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "candidate_list",
    description: "Deprecated: use candidate_query. List recent Candidates.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "candidate_query",
    description: "Query Candidate records with limit/state/since and optional field projection.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        since: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "candidate_get",
    description: "Read one Candidate record by id.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "candidate_evaluate",
    description: "Evaluate a Candidate as pass or fail and record the reviewer.",
    inputSchema: {
      type: "object",
      required: ["id", "result"],
      properties: {
        id: { type: "string" },
        result: { type: "string", enum: ["pass", "fail"] },
        reviewer: { type: "string" }
      }
    }
  }
];

// plugins/foundry/src/mcp/tools/governance.ts
var governanceTools = [
  {
    name: "governance_scan",
    description: "Scan Skill metadata for unused, low-success, duplicate, superseded, and stale Skills.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        min_success_rate: { type: "number" },
        duplicate_threshold: { type: "number" },
        stale_days: { type: "number" }
      }
    }
  },
  {
    name: "governance_resolve",
    description: "Apply an auditable governance resolution. MERGE, DEPRECATE, and RETIRE require the configured Maintainer.",
    inputSchema: {
      type: "object",
      required: ["skill", "action"],
      properties: {
        skill: { type: "string" },
        action: { type: "string", enum: ["KEEP", "EVOLVE", "MERGE", "DEPRECATE", "RETIRE"] },
        target_skill: { type: "string" },
        reason: { type: "string" },
        actor: { type: "string" },
        related_to: { type: "string" },
        depends_on: { type: "string" },
        conflicts_with: { type: "string" }
      }
    }
  },
  {
    name: "skill_graph_validate",
    description: "Validate Skill graph references: related_to, depends_on, supersedes, and conflicts_with.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "event_list",
    description: "List recent lifecycle events.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "telemetry_metrics",
    description: "Summarize IntelligenceRun and CandidateResolved telemetry with trend metrics; token counts are chars/4 estimates only.",
    inputSchema: { type: "object", properties: {} }
  }
];

// plugins/foundry/src/mcp/tools/hub.ts
var hubTools = [
  {
    name: "hub_init",
    description: "Initialize the user's local Usora storage in the host plugin data directory, local fallback directory (<cwd>/.usora), or the directory previously chosen via hub_config. Never create sample data. Optionally set maintainer/automation_policy.",
    inputSchema: {
      type: "object",
      properties: {
        maintainer: { type: "string", description: "Optional Primary Maintainer to set during init (e.g. codex)." },
        automation_policy: {
          type: "string",
          enum: AUTOMATION_POLICIES,
          description: "Optional automation policy to set during init."
        }
      }
    }
  },
  {
    name: "hub_status",
    description: "Inspect Usora counts, configuration, and resolved data locations without loading all Activities. Use this as the source of truth when users ask where Practice data, Shared Knowledge, Activity, Session, Pattern, Candidate, or Skill data lives. Returns host-local practice paths, shared knowledge paths, path resolution sources, registered Activity Source locations, counts, and next_action.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hub_query",
    description: "Query a registered host Hub without accepting arbitrary filesystem paths. Use it to inspect another host's Activities, Sessions, Events, Candidates, Skills, or Indexes from the current Usora MCP process. Pass host (codex or codebuddy), collection, optional limit, and optional fields.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string", enum: ["codex", "codebuddy"], description: "Registered host to query." },
        collection: {
          type: "string",
          enum: ["activities", "sessions", "events", "candidates", "skills", "indexes"],
          description: "Fixed Hub collection to read."
        },
        limit: { type: "number" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "hub_migrate",
    description: "Explicitly migrate a v1 Hub to the current schema. Defaults to dry run; pass confirm=true to back up and migrate.",
    inputSchema: {
      type: "object",
      properties: {
        dry_run: { type: "boolean" },
        confirm: { type: "boolean", description: "Required true to write migration changes." }
      }
    }
  },
  {
    name: "hub_doctor",
    description: "Run a lightweight local Hub health check for required directories, counts, config, and missing Skill metadata.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "hub_cleanup",
    description: "Clean in two modes: generated archives processed Activities; all permanently deletes every Usora Hub record, Skill, archive, event, and config and requires confirm=true. It empties the data directory but keeps the Hub directory and config file so the user can review the path.",
    inputSchema: {
      type: "object",
      properties: { mode: { type: "string", enum: ["generated", "all"] }, confirm: { type: "boolean" } }
    }
  },
  {
    name: "plugin_cache_cleanup",
    description: "Preview or delete old installed Usora plugin cache versions, keeping the currently running plugin version. Defaults to dry run; pass confirm=true to delete.",
    inputSchema: {
      type: "object",
      properties: {
        confirm: {
          type: "boolean",
          description: "Required true to delete old installed Usora plugin cache versions. Omit or false for dry run."
        }
      }
    }
  },
  {
    name: "hub_config",
    description: "Configure the Maintainer, automation policy, and/or relocate the data directory. Pass `path` to MOVE the existing Hub data to a new directory (migrates existing records and clears the old directory), applied immediately.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional new data directory (absolute or relative). Existing data is moved there and the old directory cleared."
        },
        maintainer: { type: "string" },
        automation_policy: { type: "string", enum: AUTOMATION_POLICIES }
      }
    }
  }
];

// plugins/foundry/src/mcp/tools/skill.ts
var skillTools = [
  {
    name: "skill_create",
    description: "Create a Skill draft with SKILL.md content.",
    inputSchema: {
      type: "object",
      required: ["name", "content"],
      properties: {
        name: { type: "string" },
        content: { type: "string" },
        description: { type: "string" },
        candidate_id: { type: "string" }
      }
    }
  },
  {
    name: "skill_generate",
    description: "Generate a deterministic Skill draft from a passing Candidate without loading full Activities.",
    inputSchema: {
      type: "object",
      required: ["candidate_id"],
      properties: {
        candidate_id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" }
      }
    }
  },
  {
    name: "skill_evolve",
    description: "Apply or recommend a SkillDelta. With a passing candidate_id, defaults to PATCH an existing similar Skill before creating a new draft.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        candidate_id: { type: "string" },
        pattern_fingerprint: { type: "string" },
        action: { type: "string", enum: ["CREATE", "PATCH", "NOOP", "SPLIT", "MERGE"] },
        reason: { type: "string" },
        evidence: { type: "array", items: { type: "object" } },
        target_skill: { type: "string" },
        threshold: { type: "number" },
        changes: {
          type: "object",
          properties: {
            content: { type: "string" },
            content_append: { type: "string" },
            description: { type: "string" }
          }
        }
      }
    }
  },
  {
    name: "skill_evaluate",
    description: "Evaluate a Skill draft as pass or fail.",
    inputSchema: {
      type: "object",
      required: ["name", "result"],
      properties: {
        name: { type: "string" },
        result: { type: "string", enum: ["pass", "fail"] },
        reviewer: { type: "string" },
        notes: { type: "string" }
      }
    }
  },
  {
    name: "skill_publish",
    description: "Publish an evaluated Skill as the configured Maintainer by updating the single current Skill in place.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: { name: { type: "string" }, actor: { type: "string" } }
    }
  },
  {
    name: "skill_read",
    description: "Read one Skill's metadata and SKILL.md content by name.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } }
  },
  {
    name: "skill_list",
    description: "Deprecated: use skill_query. List recent Skill metadata without loading SKILL.md content.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Optional result limit, default 20 and max 100." } }
    }
  },
  {
    name: "skill_index",
    description: "Query or rebuild the local Skill metadata-only index.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["query", "rebuild"] },
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        candidate_id: { type: "string" },
        since: { type: "string" },
        q: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "skill_query",
    description: "Query Skill metadata from the local index without reading SKILL.md.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Optional result limit, default 20 and max 100." },
        state: { type: "string" },
        candidate_id: { type: "string" },
        since: { type: "string" },
        q: { type: "string" },
        fields: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "skill_get",
    description: "Read one Skill metadata record plus SKILL.md content by name.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" } } }
  },
  {
    name: "usage_capture",
    description: "Record one runtime Skill usage outcome and update Skill usage metrics. Outcome may be unknown.",
    inputSchema: {
      type: "object",
      required: ["skill"],
      properties: {
        session_id: { type: "string" },
        skill: { type: "string" },
        activity_id: { type: "string" },
        outcome: { type: "string", enum: ["success", "partial", "failure", "unknown"] },
        validation_evidence: { type: "array", items: { type: "string" } },
        project: { type: "string" },
        used_at: { type: "string" }
      }
    }
  }
];

// plugins/foundry/src/mcp/tools/index.ts
var allToolDefinitions = [...hubTools, ...activityTools, ...candidateTools, ...skillTools, ...governanceTools];

// plugins/foundry/src/mcp/registry.ts
var seen = new Set;
for (const tool of allToolDefinitions) {
  if (seen.has(tool.name))
    throw new Error(`Duplicate MCP tool: ${tool.name}`);
  seen.add(tool.name);
}
var tools = allToolDefinitions;
var toolRegistry = new Map(tools.map((tool) => [tool.name, tool]));
function listTools() {
  return tools;
}
function getTool(name) {
  return toolRegistry.get(name);
}

// plugins/foundry/src/mcp/handlers.ts
var HANDLERS = {
  hub_init: handleHubInit,
  hub_migrate: handleHubMigrate,
  hub_config: handleHubConfig,
  hub_status: handleHubStatus,
  hub_doctor: handleHubDoctor,
  hub_query: handleHubQuery,
  hub_cleanup: handleHubCleanup,
  plugin_cache_cleanup: handlePluginCacheCleanup,
  context_budget: handleContextBudget,
  governance_scan: handleGovernanceScan,
  governance_resolve: handleGovernanceResolve,
  skill_graph_validate: handleSkillGraphValidate,
  activity_capture: handleActivityCapture,
  activity_digest_list: handleActivityDigestList,
  activity_list: handleActivityList,
  activity_query: handleActivityQuery,
  activity_get: handleActivityGet,
  candidate_create: handleCandidateCreate,
  candidate_match: handleCandidateMatch,
  candidate_query: handleCandidateQuery,
  candidate_get: handleCandidateGet,
  candidate_resolve: handleCandidateResolve,
  pattern_index: handlePatternIndex,
  pattern_query: handlePatternQuery,
  pattern_get: handlePatternGet,
  candidate_list: handleCandidateList,
  candidate_evaluate: handleCandidateEvaluate,
  skill_create: handleSkillCreate,
  skill_generate: handleSkillGenerate,
  skill_evolve: handleSkillEvolve,
  skill_evaluate: handleSkillEvaluate,
  skill_publish: handleSkillPublish,
  skill_read: handleSkillRead,
  skill_list: handleSkillList,
  skill_index: handleSkillIndex,
  skill_query: handleSkillQuery,
  skill_get: handleSkillGet,
  usage_capture: handleUsageCapture,
  event_list: handleEventList,
  telemetry_metrics: handleTelemetryMetrics
};
var MIGRATION_ALLOWED = new Set([
  "hub_init",
  "hub_migrate",
  "hub_status",
  "hub_doctor",
  "hub_query",
  "event_list",
  "telemetry_metrics",
  "plugin_cache_cleanup"
]);
var WRITE_TOOLS = new Set([
  "hub_config",
  "hub_cleanup",
  "activity_capture",
  "candidate_create",
  "candidate_resolve",
  "candidate_evaluate",
  "pattern_index",
  "skill_create",
  "skill_generate",
  "skill_evolve",
  "skill_evaluate",
  "skill_publish",
  "context_budget",
  "usage_capture",
  "governance_resolve"
]);
async function call(name, args = {}) {
  const handler = HANDLERS[name];
  if (!handler || !getTool(name))
    throw Error(`Unknown Usora tool: ${name}`);
  await ensure();
  if (WRITE_TOOLS.has(name) && !MIGRATION_ALLOWED.has(name) && (await migrationStatus()).migration_required) {
    throw Error("Hub migration required before writing v2 records. Run hub_migrate with dry_run, then confirm=true.");
  }
  return handler(args);
}

// plugins/foundry/src/mcp/server.ts
var pluginRoot = path20.resolve(path20.dirname(fileURLToPath3(import.meta.url)), "..", "..");
function readServerVersion() {
  try {
    const plugin = JSON.parse(readFileSync(path20.join(pluginRoot, "plugin.json"), "utf8"));
    return typeof plugin.version === "string" ? plugin.version : "2.0.0";
  } catch {
    return "2.0.0";
  }
}
var serverVersion = readServerVersion();
function jsonRpcResult(id, value) {
  return { jsonrpc: "2.0", id, result: value };
}
function toolCallResult(id, value) {
  return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
}
function jsonRpcError(id, message) {
  return { jsonrpc: "2.0", id, error: { code: -32000, message } };
}
function write(line) {
  process.stdout.write(`${JSON.stringify(line)}
`);
}
function handleRequest(req) {
  switch (req.method) {
    case "initialize":
      return jsonRpcResult(req.id, {
        protocolVersion: typeof req.params?.protocolVersion === "string" ? req.params.protocolVersion : "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "usora", version: serverVersion }
      });
    case "tools/list":
      return jsonRpcResult(req.id, { tools: listTools() });
    default:
      if (req.id !== undefined) {
        return jsonRpcError(req.id, `Unsupported method: ${req.method}`);
      }
      return null;
  }
}
function parseRequest(line) {
  const value = JSON.parse(line);
  if (!value || typeof value !== "object")
    throw new Error("Invalid JSON-RPC request");
  return value;
}
function toolCallParams(params) {
  if (!params || typeof params.name !== "string")
    throw new Error("Invalid tools/call params: name is required");
  const rawArgs = params.arguments;
  if (rawArgs === undefined)
    return { name: params.name, args: {} };
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) {
    throw new Error("Invalid tools/call params: arguments must be an object");
  }
  return { name: params.name, args: rawArgs };
}
var rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
var queue = Promise.resolve();
rl.on("line", (line) => {
  queue = queue.then(async () => {
    let req;
    try {
      req = parseRequest(line);
      let response;
      if (req.method === "tools/call") {
        const { name, args } = toolCallParams(req.params);
        const value = await call(name, args);
        response = toolCallResult(req.id, value);
      } else {
        response = handleRequest(req);
      }
      if (response)
        write(response);
    } catch (err) {
      if (req?.id !== undefined)
        write(jsonRpcError(req.id, err instanceof Error ? err.message : String(err)));
    }
  });
});
