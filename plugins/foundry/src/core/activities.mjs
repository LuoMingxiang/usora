import fs from "node:fs/promises";
import path from "node:path";
import { dirPath, ensure, newId, now, processSessionId, readJson, writeEvent, writeJson } from "./storage.mjs";
import { listLimit, mergeUnique } from "./validation.mjs";

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
    updates: [],
  };

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
  item.updates.push({
    timestamp,
    summary: args.summary || args.result || "Session captured",
    key_points: args.key_points || [],
  });
  item.updated_at = timestamp;

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
  const activitiesDir = await dirPath("activities");
  const items = [];
  for (const file of await fs.readdir(activitiesDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(activitiesDir, file));
    if (item) items.push(item);
  }
  items.sort((a, b) => (b.updated_at || b.started_at || "").localeCompare(a.updated_at || a.started_at || ""));
  return { count: items.length, activities: items.slice(0, limit) };
}
