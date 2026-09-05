import fs from "node:fs/promises";
import path from "node:path";
import { fromLegacyFoundryEvent, isUsoraEvent, type UsoraEvent } from "@usora/integration";
import { knowledgeDirPath, readJson } from "./storage.ts";
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

type StoredEvent = UsoraEvent & {
  file: string;
};

function normalizeStoredEvent(item: unknown, file: string): StoredEvent | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  if (isUsoraEvent(item)) return { ...item, file };
  return { ...fromLegacyFoundryEvent({ ...(item as Record<string, unknown>), file }), file };
}

export async function handleEventList(args: EventListArgs = {}) {
  const limit = listLimit(args.limit);
  const eventsDir = await knowledgeDirPath("events");
  const items: StoredEvent[] = [];
  for (const file of await fs.readdir(eventsDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(eventsDir, file));
    const event = normalizeStoredEvent(item, file);
    if (event) items.push(event);
  }
  items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return { count: items.length, events: items.slice(0, limit) };
}
