import fs from "node:fs/promises";
import path from "node:path";
import { readJson } from "./storage.ts";
import { listLimit, safeName } from "./validation.ts";
import { describeActivitySources } from "../sources/registry.ts";

const COLLECTIONS = ["activities", "sessions", "events", "candidates", "skills", "indexes"] as const;

type Collection = (typeof COLLECTIONS)[number];
type HubQueryArgs = {
  host?: unknown;
  collection?: unknown;
  limit?: unknown;
  fields?: unknown;
};
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collection(value: unknown): Collection {
  if (typeof value !== "string" || !COLLECTIONS.includes(value as Collection)) {
    throw Error(`collection must be one of: ${COLLECTIONS.join(", ")}`);
  }
  return value as Collection;
}

function pickFields(item: JsonRecord, fields: unknown): JsonRecord {
  if (!Array.isArray(fields) || fields.length === 0) return item;
  return Object.fromEntries(
    fields
      .filter((field): field is string => typeof field === "string" && field in item)
      .map((field) => [field, item[field]]),
  );
}

async function hostRoots(host: string): Promise<Array<{ id: string; host: string; root: string }>> {
  const seen = new Set<string>();
  const result = [];
  for (const source of await describeActivitySources()) {
    if (source.host !== host || !source.root) continue;
    const key = path.resolve(source.root).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id: source.id, host: source.host, root: source.root });
  }
  return result;
}

async function readJsonDir(dir: string, fields: unknown): Promise<JsonRecord[]> {
  const items = [];
  for (const file of await fs.readdir(dir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(dir, file));
    if (isRecord(item)) items.push(pickFields({ ...item, file }, fields));
  }
  return items;
}

async function readSkills(dir: string, fields: unknown): Promise<JsonRecord[]> {
  const items = [];
  for (const entry of await fs.readdir(dir).catch(() => [])) {
    const item = await readJson(path.join(dir, entry, "skill.json"));
    if (isRecord(item)) items.push(pickFields({ ...item, dir: entry }, fields));
  }
  return items;
}

async function readCollection(root: string, name: Collection, fields: unknown): Promise<JsonRecord[]> {
  const dir = path.join(root, name);
  return name === "skills" ? readSkills(dir, fields) : readJsonDir(dir, fields);
}

export async function handleHubQuery(args: HubQueryArgs = {}) {
  const host = safeName(args.host || "codex", "host");
  const name = collection(args.collection || "activities");
  const limit = listLimit(args.limit);
  const roots = await hostRoots(host);
  if (roots.length === 0) return { host, collection: name, available: false, count: 0, records: [] };

  const records: JsonRecord[] = [];
  for (const root of roots) {
    for (const item of await readCollection(root.root, name, args.fields)) {
      records.push({ source: root.id, host: root.host, root: root.root, ...item });
    }
  }
  records.sort((a, b) =>
    String(b.updated_at || b.timestamp || b.created_at || "").localeCompare(
      String(a.updated_at || a.timestamp || a.created_at || ""),
    ),
  );
  return { host, collection: name, available: true, count: records.length, records: records.slice(0, limit) };
}
