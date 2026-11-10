import fs from "node:fs/promises";
import path from "node:path";
import { hostDirPath, knowledgeDirPath } from "./storage.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Collect direct evidence and evidence retained in Skill evolution history. */
function collectReferences(value: unknown, ids: Set<string>, evidence = false): void {
  if (typeof value === "string") {
    if (evidence) ids.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, ids, evidence);
  } else if (isRecord(value)) {
    if (typeof value.activity_id === "string") ids.add(value.activity_id);
    if (evidence && typeof value.id === "string") ids.add(value.id);
    for (const [key, item] of Object.entries(value)) collectReferences(item, ids, key === "evidence");
  }
}

async function readReferences(dir: string, ids: Set<string>): Promise<void> {
  let entries;
  try {
    if ((await fs.lstat(dir)).isSymbolicLink()) throw Error(`Cannot verify archive references through symlink: ${dir}`);
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error(`Cannot verify archive references through symlink: ${file}`);
    if (entry.isDirectory()) await readReferences(file, ids);
    else if (entry.isFile() && entry.name.endsWith(".json")) {
      try {
        const value: unknown = JSON.parse(await fs.readFile(file, "utf8"));
        if (!isRecord(value)) throw Error("expected a JSON object");
        collectReferences(value, ids);
      } catch {
        throw Error(`Cannot verify archive references: ${file}`);
      }
    }
  }
}

/** Preview by default; deletion is restricted to unreferenced local archived Activities. */
export async function cleanupArchive(confirm: boolean) {
  const ids = new Set<string>();
  await readReferences(await knowledgeDirPath("candidates"), ids);
  await readReferences(await knowledgeDirPath("skills"), ids);
  const archive = await hostDirPath("archive");
  if ((await fs.lstat(archive)).isSymbolicLink()) throw Error("Cannot clean a symlinked archive directory");
  const result = { mode: "archive", dry_run: !confirm, eligible: 0, deleted: 0, protected: 0, skipped: 0 };
  const entries = await fs.readdir(archive, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      result.skipped++;
      continue;
    }
    const file = path.join(archive, entry.name);
    let record: unknown;
    try {
      record = JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      result.skipped++;
      continue;
    }
    if (!isRecord(record) || typeof record.id !== "string" || !record.id.trim()) {
      result.skipped++;
      continue;
    }
    if (ids.has(record.id)) {
      result.protected++;
      continue;
    }
    result.eligible++;
    if (confirm) {
      await fs.unlink(file);
      result.deleted++;
    }
  }
  return result;
}
