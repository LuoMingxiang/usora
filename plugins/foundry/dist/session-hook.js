#!/usr/bin/env node

// plugins/foundry/src/hooks/session-hook.ts
import { stdin } from "node:process";

// plugins/foundry/src/adapters/codebuddy-session.ts
import fs from "node:fs/promises";
import path from "node:path";

// plugins/foundry/src/core/session-protocol.ts
var USORA_SESSION_PROTOCOL_VERSION = 1;
var SESSION_EVENT_TYPES = ["user", "assistant", "tool", "command", "error", "validation", "event"];
function compactText(value, limit = 2000) {
  const text = String(value || "").replace(/<additional_data>[\s\S]*?<\/additional_data>/g, "").replace(/<\/?user_query>/g, "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}
function normalizeSessionProtocol(session = {}) {
  const messages = [];
  const rawMessages = Array.isArray(session.messages) ? session.messages : [];
  for (const rawMessage of rawMessages) {
    const message = rawMessage && typeof rawMessage === "object" ? rawMessage : {};
    const rawRole = typeof message.role === "string" ? message.role : undefined;
    const role = rawRole && SESSION_EVENT_TYPES.includes(rawRole) ? rawRole : "event";
    const text = compactText(message.text || message.content || message.message || "");
    if (!text)
      continue;
    messages.push({
      id: message.id ?? null,
      role,
      event_type: role === "event" ? rawRole || "unsupported" : message.event_type || role,
      timestamp: message.timestamp ?? null,
      text
    });
  }
  return {
    schema_version: USORA_SESSION_PROTOCOL_VERSION,
    source: session.source || "unknown",
    source_ref: session.source_ref ?? null,
    messages
  };
}

// plugins/foundry/src/adapters/codebuddy-session.ts
function parseJson(value) {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}
function textFromContent(content) {
  if (typeof content === "string")
    return content;
  if (!Array.isArray(content))
    return "";
  return content.map((block) => block && typeof block === "object" ? block.text : "").filter((text) => typeof text === "string" && Boolean(text)).join(`
`);
}
async function readMessage(file, fallback = {}) {
  const item = parseJson(await fs.readFile(file, "utf8"));
  const extra = parseJson(item?.extra);
  const message = parseJson(item?.message);
  return {
    id: fallback.id,
    role: item?.role || fallback.role,
    timestamp: item?.timestamp || item?.created_at || fallback.timestamp || null,
    text: compactText(textFromContent(extra?.sourceContentBlocks) || textFromContent(message?.content))
  };
}
async function readCodeBuddySession(transcriptPath) {
  if (!transcriptPath)
    return normalizeSessionProtocol({ source: "codebuddy", messages: [] });
  const index = parseJson(await fs.readFile(transcriptPath, "utf8").catch(() => ""));
  const messages = [];
  const indexMessages = Array.isArray(index?.messages) ? index.messages : [];
  for (const rawEntry of indexMessages) {
    const entry = rawEntry && typeof rawEntry === "object" ? rawEntry : {};
    if (entry.role !== "user" && entry.role !== "assistant")
      continue;
    const file = path.join(path.dirname(transcriptPath), "messages", `${entry.id}.json`);
    const message = await readMessage(file, entry).catch(() => null);
    if (message?.text)
      messages.push(message);
  }
  return normalizeSessionProtocol({
    source: "codebuddy",
    source_ref: { type: "host_transcript", path: transcriptPath },
    messages
  });
}

// plugins/foundry/src/adapters/codex-session.ts
function readCodexSession(event) {
  const messages = [];
  const rawMessages = Array.isArray(event.messages) ? event.messages : Array.isArray(event.session?.messages) ? event.session.messages : [];
  for (const rawMessage of rawMessages) {
    const message = rawMessage && typeof rawMessage === "object" ? rawMessage : {};
    if (!message.role || !["user", "assistant", "tool", "command", "error", "validation"].includes(message.role)) {
      continue;
    }
    const text = compactText(message.text || message.content || message.message || "");
    if (text)
      messages.push({ id: message.id ?? null, role: message.role, timestamp: message.timestamp ?? null, text });
  }
  return normalizeSessionProtocol({ source: "codex", messages });
}

// plugins/foundry/src/core/activities.ts
import fs3 from "node:fs/promises";
import path3 from "node:path";

// plugins/foundry/src/core/storage.ts
import fs2 from "node:fs/promises";
import os from "node:os";
import path2 from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
var runtimeDir = path2.dirname(fileURLToPath(import.meta.url));
var runtimePluginRoot = path2.basename(runtimeDir) === "dist" ? path2.resolve(runtimeDir, "..") : path2.resolve(runtimeDir, "..", "..");
var lowerRuntimePluginRoot = runtimePluginRoot.toLowerCase();
var isCodeBuddyInstall = lowerRuntimePluginRoot.includes(path2.join(".codebuddy", "plugins", "marketplaces").toLowerCase());
var isCodexInstall = lowerRuntimePluginRoot.includes(path2.join(".codex", "plugins", "cache").toLowerCase());
var anchorHome = process.env.CODEBUDDY_PLUGIN_DATA ? path2.resolve(process.env.CODEBUDDY_PLUGIN_DATA, ".usora") : process.env.PLUGIN_DATA ? path2.resolve(process.env.PLUGIN_DATA, ".usora") : process.env.CODEBUDDY_PLUGIN_ROOT || isCodeBuddyInstall ? path2.join(os.homedir(), ".codebuddy", "plugins", "data", "usora", ".usora") : process.env.CLAUDE_PLUGIN_ROOT || isCodexInstall ? path2.join(os.homedir(), ".codex", "plugins", "data", "usora", ".usora") : path2.resolve(process.cwd(), ".usora");
var processSessionId = `session-${Date.now().toString(16).padStart(12, "0")}-${crypto.randomBytes(16).toString("hex")}`;
var HUB_SCHEMA_VERSION = 2;
var ACTIVITY_SCHEMA_VERSION = 2;
var SESSION_RECORD_SCHEMA_VERSION = 1;
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
function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
var now = () => new Date().toISOString();
var newId = (prefix) => `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
async function resolveHome(config) {
  const cfg = config || await loadConfig();
  return typeof cfg.hub_path === "string" && cfg.hub_path ? path2.resolve(cfg.hub_path) : anchorHome;
}
async function dirPath(dir) {
  return path2.join(await resolveHome(), dir);
}
async function ensure() {
  const home = await resolveHome();
  await Promise.all(DIRS.map((dir) => fs2.mkdir(path2.join(home, dir), { recursive: true })));
}
async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs2.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}
async function exists(file) {
  try {
    await fs2.access(file);
    return true;
  } catch {
    return false;
  }
}
function isInside(parent, child) {
  const rel = path2.relative(parent, child);
  return rel === "" || !!rel && !rel.startsWith("..") && !path2.isAbsolute(rel);
}
async function copyHubData(sourceHome, targetHome) {
  if (path2.resolve(sourceHome) === path2.resolve(targetHome))
    return;
  for (const dir of DIRS) {
    const src = path2.join(sourceHome, dir);
    if (!await exists(src))
      continue;
    await fs2.mkdir(path2.join(targetHome, dir), { recursive: true });
    await fs2.cp(src, path2.join(targetHome, dir), { recursive: true, force: false, errorOnExist: false });
  }
}
async function migrateLegacyConfig() {
  const currentConfig = path2.join(anchorHome, "config.json");
  if (await exists(currentConfig))
    return null;
  const legacyHomes = [path2.join(runtimePluginRoot, ".usora"), path2.resolve(process.cwd(), ".usora")];
  for (const legacyHome of legacyHomes) {
    const config = await readJson(path2.join(legacyHome, "config.json"));
    if (!isObject(config))
      continue;
    const legacyHub = typeof config.hub_path === "string" && config.hub_path ? path2.resolve(config.hub_path) : legacyHome;
    if (legacyHome !== path2.join(runtimePluginRoot, ".usora") && !isInside(runtimePluginRoot, legacyHub))
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
  await fs2.writeFile(tmp, `${JSON.stringify(value, null, 2)}
`, "utf8");
  await fs2.rename(tmp, file);
}
async function writeEvent(type, data) {
  const file = path2.join(await dirPath("events"), `${Date.now()}-${newId("event")}.json`);
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
  const config = await readJson(path2.join(anchorHome, "config.json"), {
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
  await fs2.mkdir(anchorHome, { recursive: true });
  await writeJson(path2.join(anchorHome, "config.json"), next);
  return next;
}

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
function mergeUnique(left, right) {
  return [...new Set([...left || [], ...right || []])];
}

// plugins/foundry/src/core/activities.ts
var RECENT_UPDATE_LIMIT = 10;
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
async function findActivityBySession(sessionId) {
  const dir = await dirPath("activities");
  for (const file of await fs3.readdir(dir).catch(() => [])) {
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
  await writeJson(path3.join(await dirPath("activities"), file), item);
  await writeEvent(existing ? "ActivityUpdated" : "ActivityCreated", item);
  return { ...item, merged: Boolean(existing) };
}

// plugins/foundry/src/core/intelligence/event-detector.ts
var DETECTORS = [
  ["constraint", /不要|必须|要求|限制|注意|只需要|不能|do not|must|require|only/i, 0.85],
  ["correction", /不是|改成|我的意思|纠正|应该是|actually|instead|correction/i, 0.9],
  ["attempt", /尝试|试试|先用|attempt|try|tried/i, 0.7],
  ["failure", /失败|不行|还是不行|报错|failed|does not work|error/i, 0.85],
  ["decision", /最终|采用|确定|决定|结论|decision|decided|use /i, 0.8],
  ["verification", /验证|通过|测试|确认|verified|passes|works/i, 0.8],
  ["result", /完成|解决|修复|done|fixed|implemented/i, 0.75]
];
function detectSemanticEvents(events) {
  const semanticEvents = [];
  for (const event of events) {
    for (const [type, pattern, confidence] of DETECTORS) {
      const text = typeof event.text === "string" ? event.text : "";
      if (pattern.test(text)) {
        semanticEvents.push({ type, confidence, source_event_id: event.id, text });
      }
    }
  }
  return semanticEvents;
}

// plugins/foundry/src/core/intelligence/knowledge-extractor.ts
function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
function scoreUserEvent(event) {
  let score = 0;
  if (event.index === 0)
    score += 3;
  if (/不要|必须|要求|限制|注意|只需要|不能|do not|must|require|only/i.test(event.text))
    score += 5;
  if (/不是|改成|我的意思|纠正|应该是|actually|instead|correction/i.test(event.text))
    score += 5;
  if (/最终|采用|确定|决定|结论|原因|decision|decided|because/i.test(event.text))
    score += 4;
  if (/失败|不行|报错|failed|error/i.test(event.text))
    score += 3;
  if (event.text.length < 8)
    score -= 3;
  return score;
}
function extractKnowledge(events, semanticEvents) {
  const users = events.filter((event) => event.role === "user");
  const assistants = events.filter((event) => event.role === "assistant");
  const byType = (type) => semanticEvents.filter((event) => event.type === type).map((event) => compactText(event.text, 240));
  const ranked = users.map((event) => ({ event, score: scoreUserEvent(event) })).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.event.index - b.event.index).slice(0, 8).sort((a, b) => a.event.index - b.event.index).map((item) => compactText(item.event.text, 240));
  const semanticPoints = semanticEvents.filter((event) => ["constraint", "correction", "decision", "failure", "verification"].includes(event.type)).map((event) => compactText(event.text, 240));
  const result = assistants.at(-1)?.text;
  const key_points = unique([...ranked, ...semanticPoints]).slice(0, 12);
  return {
    initial_task: users[0]?.text,
    final_task: byType("correction").at(-1) || users.at(-1)?.text || users[0]?.text,
    task: users[0]?.text,
    result,
    effective_result: result,
    summary: result ? compactText(result, 200) : undefined,
    constraints: byType("constraint"),
    corrections: byType("correction"),
    decisions: byType("decision"),
    failures: byType("failure"),
    knowledge_points: key_points,
    key_points
  };
}

// plugins/foundry/src/core/intelligence/session-parser.ts
function parseSessionEvents(session) {
  const normalized = normalizeSessionProtocol(session);
  return (normalized.messages || []).map((message, index) => ({
    id: message.id || `event-${index + 1}`,
    index,
    role: message.role,
    timestamp: message.timestamp || null,
    text: message.text || ""
  }));
}

// plugins/foundry/src/core/intelligence/session-graph.ts
function buildSessionGraph(events, semanticEvents) {
  const byType = (type) => semanticEvents.filter((event) => event.type === type);
  return {
    task: events.find((event) => event.role === "user")?.id || null,
    constraints: byType("constraint").map((event) => event.source_event_id),
    corrections: byType("correction").map((event) => event.source_event_id),
    attempts: byType("attempt").map((event) => event.source_event_id),
    failures: byType("failure").map((event) => event.source_event_id),
    decisions: byType("decision").map((event) => event.source_event_id),
    verifications: byType("verification").map((event) => event.source_event_id)
  };
}

// plugins/foundry/src/core/intelligence/session-compiler.ts
function compileSessionKnowledge(session = {}) {
  const events = parseSessionEvents(session);
  const semantic_events = detectSemanticEvents(events);
  const graph = buildSessionGraph(events, semantic_events);
  const activity = extractKnowledge(events, semantic_events);
  const storedEvents = events.map(({ text, ...event }) => ({ ...event, text_chars: text.length }));
  const countType = (type) => semantic_events.filter((event) => event.type === type).length;
  const complexity = {
    message_count: events.length,
    corrections: countType("correction"),
    failed_attempts: countType("failure"),
    task_changed: countType("correction") > 0,
    needs_llm_compression: false
  };
  return {
    activity,
    session_record: {
      events: storedEvents,
      semantic_events,
      graph,
      knowledge: {
        initial_task: activity.initial_task || null,
        final_task: activity.final_task || null,
        constraints: activity.constraints,
        corrections: activity.corrections,
        decisions: activity.decisions,
        failures: activity.failures,
        knowledge_points: activity.knowledge_points,
        effective_result: activity.effective_result || null
      },
      complexity,
      source_ref: session.source_ref || null,
      message_count: events.length
    }
  };
}

// plugins/foundry/src/core/sessions.ts
import crypto3 from "node:crypto";
import path4 from "node:path";
function sessionFile(sessionId) {
  const hash = crypto3.createHash("sha256").update(sessionId || "unknown").digest("hex").slice(0, 24);
  return `session-${hash}.json`;
}
async function writeSessionRecord(sessionId, record) {
  await ensure();
  const timestamp = now();
  const item = {
    schema_version: SESSION_RECORD_SCHEMA_VERSION,
    id: sessionId || `session-${timestamp}`,
    session_id: sessionId || null,
    updated_at: timestamp,
    ...record
  };
  await writeJson(path4.join(await dirPath("sessions"), sessionFile(item.id)), item);
  return item;
}

// plugins/foundry/src/hooks/session-hook.ts
async function readStdin() {
  const chunks = [];
  for await (const chunk of stdin)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
function validTimestamp(value) {
  const date = new Date(typeof value === "string" || typeof value === "number" ? value : "");
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}
function hostSource() {
  if (process.env.CODEBUDDY_PLUGIN_ROOT || process.env.CODEBUDDY_PLUGIN_DATA)
    return "codebuddy";
  return "codex";
}
function getPath(event, keys) {
  let value = event;
  for (const key of keys) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return;
    value = value[key];
  }
  return value;
}
function stringValue(value) {
  return typeof value === "string" ? value : undefined;
}
function activityId(value) {
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.id === "string") {
    return value.id;
  }
  return "unknown";
}
function eventSource(event) {
  return stringValue(event.source) ?? hostSource();
}
async function readSession(event, transcriptPath) {
  if (eventSource(event) === "codebuddy")
    return readCodeBuddySession(transcriptPath);
  const codex = readCodexSession(event);
  if (codex.messages.length)
    return codex;
  return readCodeBuddySession(transcriptPath);
}
async function main() {
  const raw = await readStdin();
  if (!raw)
    return;
  let event;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw Error("event must be an object");
    event = parsed;
  } catch (err) {
    console.error("Failed to parse stdin JSON:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
  const sessionId = stringValue(event.session_id) ?? stringValue(event.sessionId) ?? stringValue(getPath(event, ["session", "id"])) ?? stringValue(getPath(event, ["session", "session_id"]));
  const transcriptPath = stringValue(event.transcript_path) ?? stringValue(event.transcriptPath) ?? stringValue(getPath(event, ["transcript", "path"])) ?? stringValue(getPath(event, ["session", "transcript"]));
  const session = await readSession(event, transcriptPath);
  const compiled = compileSessionKnowledge(session);
  const project = stringValue(event.cwd) ?? stringValue(event.workingDirectory) ?? stringValue(getPath(event, ["session", "cwd"])) ?? process.cwd();
  if (sessionId || compiled.session_record.message_count > 0) {
    await writeSessionRecord(sessionId, {
      ...compiled.session_record,
      source: eventSource(event),
      project
    });
  }
  const activity = await captureActivity({
    session_id: sessionId,
    source: eventSource(event),
    project,
    timestamp: validTimestamp(event.timestamp ?? event.time ?? event.ended_at),
    task: event.task ?? compiled.activity.task ?? null,
    result: event.result ?? compiled.activity.result ?? null,
    summary: stringValue(event.summary) || compiled.activity.summary || "SessionEnd captured",
    key_points: Array.isArray(event.key_points) ? event.key_points : compiled.activity.key_points || [],
    context: transcriptPath || "",
    metadata: transcriptPath ? { transcript_path: transcriptPath, enrichment: compiled.activity.result ? "compiler" : "pending" } : undefined
  }, { requireTaskResult: false });
  console.log(`Captured activity: ${activityId(activity)}`);
}
main().catch((err) => {
  console.error("session-hook error:", err);
  process.exit(1);
});
