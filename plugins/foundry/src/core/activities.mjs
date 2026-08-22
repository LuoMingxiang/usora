import fs from "node:fs/promises";
import path from "node:path";
import {
  ACTIVITY_SCHEMA_VERSION,
  dirPath,
  ensure,
  newId,
  now,
  processSessionId,
  readJson,
  writeEvent,
  writeJson,
} from "./storage.mjs";
import { buildActivityDigest } from "./intelligence/digest.mjs";
import { buildActivityFingerprint } from "./intelligence/fingerprint.mjs";
import { listLimit, mergeUnique, safeName } from "./validation.mjs";

export const ACTIVITY_STATES = ["NEW", "INDEXED", "ABSORBED", "ARCHIVED"];
const ACTIVITY_TRANSITIONS = {
  NEW: ["INDEXED"],
  INDEXED: ["ABSORBED"],
  ABSORBED: ["ARCHIVED"],
  ARCHIVED: [],
};
const RECENT_UPDATE_LIMIT = 10;

/**
 * Find the Activity record (and its filename) for a given session id.
 *
 * @param {string} sessionId - Session id to look up.
 * @returns {Promise<{ file: string; item: object } | null>} Match, or `null` if none.
 */
async function findActivityBySession(sessionId) {
  const dir = await dirPath("activities");
  for (const file of await fs.readdir(dir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(dir, file));
    if (item?.session_id === sessionId) return { file, item };
  }
  return null;
}

async function readActivities() {
  const activitiesDir = await dirPath("activities");
  const items = [];
  for (const file of await fs.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(activitiesDir, file));
    if (item) items.push(item);
  }
  return items;
}

function pickFields(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0) return item;
  return Object.fromEntries(fields.filter((field) => field in item).map((field) => [field, item[field]]));
}

function normalizeActivityHistory(item) {
  item.recent_updates = item.recent_updates || item.updates || [];
  item.history = item.history || {
    update_count: item.recent_updates.length,
    first_seen: item.started_at || item.recent_updates[0]?.timestamp || null,
    last_seen: item.updated_at || item.recent_updates.at(-1)?.timestamp || null,
    key_points: item.key_points || [],
    segments: [],
  };
  delete item.updates;
}

function pushActivityUpdate(item, update) {
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
  if (item.history.source_ref || !item.metadata?.transcript_path) return;
  item.history.source_ref = { type: "host_transcript", path: item.metadata.transcript_path };
}

export function transitionActivityState(item, nextState) {
  if (!ACTIVITY_STATES.includes(nextState)) throw Error("invalid Activity state");
  if (item.state === nextState) return item;
  if (!ACTIVITY_TRANSITIONS[item.state]?.includes(nextState)) {
    throw Error(`invalid Activity state transition: ${item.state} -> ${nextState}`);
  }
  item.state = nextState;
  return item;
}

/**
 * `activity_capture`: create or merge one Activity per session.
 *
 * When `args.session_id` is absent, the process-scoped `processSessionId` is used, so repeated calls within one MCP
 * process merge into a single record.
 *
 * @param {ToolArgs} args - Capture fields (see `activity_capture` tool schema).
 * @returns {Promise<object>} The Activity with an added `merged` flag.
 * @throws {Error} When `task` or `result` is missing.
 */
export async function captureActivity(args, options = {}) {
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
      segments: [],
    },
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
    key_points: args.key_points || [],
  });
  item.updated_at = timestamp;
  const fingerprint = buildActivityFingerprint(item);
  item.fingerprint_version = fingerprint.version;
  item.fingerprint = fingerprint.value;
  item.digest = buildActivityDigest(item);

  const file = existing?.file || `${item.id}.json`;
  await writeJson(path.join(await dirPath("activities"), file), item);
  await writeEvent(existing ? "ActivityUpdated" : "ActivityCreated", item);
  return { ...item, merged: Boolean(existing) };
}

export async function handleActivityCapture(args) {
  return captureActivity(args);
}

/**
 * `activity_list`: list recent Activities without loading archives.
 *
 * @param {ToolArgs} [args={}] - Optional `limit` (default 20, max 100). Default is `{}`
 * @returns {Promise<object>} Count and recent Activities.
 */
export async function handleActivityList(args = {}) {
  const limit = listLimit(args.limit);
  const items = await readActivities();
  items.sort((a, b) => (b.updated_at || b.started_at || "").localeCompare(a.updated_at || a.started_at || ""));
  return { count: items.length, activities: items.slice(0, limit) };
}

export async function handleActivityDigestList(args = {}) {
  const list = await handleActivityList(args);
  return {
    count: list.count,
    activities: list.activities.map((activity) => activity.digest || buildActivityDigest(activity)),
  };
}

export async function handleActivityQuery(args = {}) {
  const limit = listLimit(args.limit);
  let activities = await readActivities();
  if (args.state) activities = activities.filter((activity) => activity.state === args.state);
  if (args.since)
    activities = activities.filter((activity) => (activity.updated_at || activity.started_at || "") >= args.since);
  activities.sort((a, b) => (b.updated_at || b.started_at || "").localeCompare(a.updated_at || a.started_at || ""));
  const projection = args.projection || "digest";
  return {
    count: activities.length,
    activities: activities.slice(0, limit).map((activity) => {
      if (args.fields) return pickFields(activity, args.fields);
      return projection === "full" ? activity : activity.digest || buildActivityDigest(activity);
    }),
  };
}

export async function handleActivityGet(args = {}) {
  const id = safeName(args.id, "id");
  const activity = await readJson(path.join(await dirPath("activities"), `${id}.json`));
  if (!activity) throw Error("Activity not found");
  return pickFields(activity, args.fields);
}
