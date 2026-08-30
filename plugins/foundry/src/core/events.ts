import fs from "node:fs/promises";
import path from "node:path";
import { dirPath, readJson } from "./storage.ts";
import { listLimit } from "./validation.ts";

/**
 * `event_list`: list recent lifecycle events.
 *
 * @param {ToolArgs} [args={}] - Optional `limit` (default 20, max 100). Default is `{}`
 * @returns {Promise<object>} Count and recent events.
 */
type EventListArgs = {
  limit?: unknown;
};

type StoredEvent = Record<string, unknown> & {
  timestamp?: string;
  file: string;
};

export async function handleEventList(args: EventListArgs = {}) {
  const limit = listLimit(args.limit);
  const eventsDir = await dirPath("events");
  const items: StoredEvent[] = [];
  for (const file of await fs.readdir(eventsDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(eventsDir, file));
    if (item && typeof item === "object" && !Array.isArray(item)) items.push({ ...item, file });
  }
  items.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  return { count: items.length, events: items.slice(0, limit) };
}
