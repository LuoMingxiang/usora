import fs from "node:fs/promises";
import path from "node:path";
import {
  ACTIVITY_SCHEMA_VERSION,
  CANDIDATE_SCHEMA_VERSION,
  DIRS,
  HUB_SCHEMA_VERSION,
  KNOWLEDGE_DIRS,
  SKILL_METADATA_SCHEMA_VERSION,
  anchorHome,
  knowledgeDirPath,
  loadConfig,
  readJson,
  resolveHome,
  resolveKnowledgeHome,
  saveConfig,
  writeEvent,
  writeJson,
} from "./storage.ts";
import { describeActivitySources } from "../sources/registry.ts";

type JsonRecord = Record<string, unknown>;
type HubMigrateArgs = {
  dry_run?: boolean;
  confirm?: boolean;
};
type MigrationConflict = {
  type: "candidate" | "skill";
  source: string;
  id: string;
  recommended_resolution: string;
};
type MigrationReport = {
  schema_version: number;
  generated_at: string;
  sources: string[];
  migrated: Record<string, number>;
  conflicts: MigrationConflict[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function needsMigration(
  config: { hub_schema_version?: unknown; version?: unknown } | null | undefined,
): boolean {
  return Number(config?.hub_schema_version || config?.version || 1) < HUB_SCHEMA_VERSION;
}

async function countJsonFiles(home: string, dir: string): Promise<number> {
  const root = path.join(home, dir);
  let count = 0;
  for (const file of await fs.readdir(root).catch(() => [])) {
    if (file.endsWith(".json")) count += 1;
  }
  return count;
}

async function backupHub(home: string): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(home, "backups", `migration-v1-to-v2-${stamp}`);
  await fs.mkdir(backup, { recursive: true });
  for (const dir of DIRS) {
    if (dir === "backups") continue;
    await fs.cp(path.join(home, dir), path.join(backup, dir), { recursive: true, force: true }).catch(() => {});
  }
  await fs.cp(path.join(anchorHome, "config.json"), path.join(backup, "config.json"), { force: true });
  return backup;
}

async function ensureKnowledgeDirs(home: string): Promise<void> {
  await Promise.all(KNOWLEDGE_DIRS.map((dir) => fs.mkdir(path.join(home, dir), { recursive: true })));
}

async function restoreHub(home: string, backup: string): Promise<void> {
  for (const dir of DIRS) {
    if (dir === "backups") continue;
    await fs.rm(path.join(home, dir), { recursive: true, force: true });
    await fs.cp(path.join(backup, dir), path.join(home, dir), { recursive: true, force: true }).catch(() => {});
  }
  await fs.cp(path.join(backup, "config.json"), path.join(anchorHome, "config.json"), { force: true });
}

async function migrateActivities(home: string): Promise<number> {
  const root = path.join(home, "activities");
  let count = 0;
  for (const file of await fs.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson<JsonRecord>(path.join(root, file));
    if (!isRecord(item)) continue;
    item.schema_version = ACTIVITY_SCHEMA_VERSION;
    item.state ||= "NEW";
    item.recent_updates ||= item.updates || [];
    delete item.updates;
    item.history ||= {
      update_count: Array.isArray(item.recent_updates) ? item.recent_updates.length : 0,
      first_seen: item.started_at || item.created_at || null,
      last_seen: item.updated_at || null,
      key_points: item.key_points || [],
      segments: [],
    };
    await writeJson(path.join(root, file), item);
    count += 1;
  }
  return count;
}

async function migrateCandidates(home: string): Promise<number> {
  const root = path.join(home, "candidates");
  let count = 0;
  for (const file of await fs.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson<JsonRecord>(path.join(root, file));
    if (!isRecord(item)) continue;
    item.schema_version = CANDIDATE_SCHEMA_VERSION;
    item.domain ||= null;
    item.topic ||= null;
    item.tags ||= [];
    item.technologies ||= [];
    item.fingerprint ||= null;
    item.occurrences ||= Array.isArray(item.evidence) ? item.evidence.length || 1 : 1;
    item.confidence ??= null;
    const evidenceItems = Array.isArray(item.evidence) ? item.evidence : [];
    item.evidence = evidenceItems.map((evidence) =>
      typeof evidence === "string" ? { activity_id: evidence, reason: "" } : evidence,
    );
    item.resolution ||= null;
    item.resolution_reason ||= "";
    item.merge_target ||= null;
    item.state ||= "OPEN";
    item.updated_at ||= item.created_at || new Date().toISOString();
    await writeJson(path.join(root, file), item);
    count += 1;
  }
  return count;
}

async function migrateSkills(home: string): Promise<number> {
  const root = path.join(home, "skills");
  let count = 0;
  for (const dir of await fs.readdir(root).catch(() => [])) {
    const file = path.join(root, dir, "skill.json");
    const item = await readJson<JsonRecord>(file);
    if (!isRecord(item)) continue;
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

function unique(values: unknown[]): unknown[] {
  return [...new Set(values.filter(Boolean))];
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function sourceHomes(hostHome: string): Promise<string[]> {
  const sources = await describeActivitySources();
  return [
    ...new Set([hostHome, ...sources.map((source) => source.root).filter((root): root is string => Boolean(root))]),
  ];
}

async function migratePatternsFromSource(source: string, target: string): Promise<number> {
  const sourceFile = path.join(source, "indexes", "patterns.json");
  const sourceIndex = await readJson<{ patterns?: JsonRecord[] }>(sourceFile);
  if (!Array.isArray(sourceIndex?.patterns)) return 0;
  const targetFile = path.join(target, "indexes", "patterns.json");
  const targetIndex = (await readJson<{ patterns?: JsonRecord[] }>(targetFile)) || { schema_version: 1, patterns: [] };
  targetIndex.patterns = Array.isArray(targetIndex.patterns) ? targetIndex.patterns : [];

  let migrated = 0;
  for (const sourcePattern of sourceIndex.patterns) {
    if (!isRecord(sourcePattern) || typeof sourcePattern.fingerprint !== "string") continue;
    let targetPattern = targetIndex.patterns.find((item) => item.fingerprint === sourcePattern.fingerprint);
    if (!targetPattern) {
      targetIndex.patterns.push(sourcePattern);
      migrated += 1;
      continue;
    }
    const refs = [...(Array.isArray(targetPattern.activity_refs) ? targetPattern.activity_refs : [])];
    for (const id of Array.isArray(sourcePattern.activity_ids) ? sourcePattern.activity_ids : []) {
      refs.push({ source: path.basename(path.dirname(source)), id });
    }
    targetPattern.activity_refs = unique([
      ...refs.map((ref) => (isRecord(ref) ? `${ref.source}:${ref.id}` : null)),
      ...(Array.isArray(sourcePattern.activity_refs)
        ? sourcePattern.activity_refs.map((ref) => (isRecord(ref) ? `${ref.source}:${ref.id}` : null))
        : []),
    ]).map((ref) => {
      const [sourceId, id] = String(ref).split(":");
      return { source: sourceId, id };
    });
    targetPattern.activity_ids = unique([
      ...(Array.isArray(targetPattern.activity_ids) ? targetPattern.activity_ids : []),
      ...(Array.isArray(sourcePattern.activity_ids) ? sourcePattern.activity_ids : []),
    ]);
    targetPattern.source_hosts = unique([
      ...(Array.isArray(targetPattern.source_hosts) ? targetPattern.source_hosts : []),
      ...(Array.isArray(sourcePattern.source_hosts) ? sourcePattern.source_hosts : []),
    ]);
    targetPattern.project_ids = unique([
      ...(Array.isArray(targetPattern.project_ids) ? targetPattern.project_ids : []),
      ...(Array.isArray(sourcePattern.project_ids) ? sourcePattern.project_ids : []),
    ]);
    targetPattern.occurrences = Array.isArray(targetPattern.activity_refs)
      ? targetPattern.activity_refs.length
      : Array.isArray(targetPattern.activity_ids)
        ? targetPattern.activity_ids.length
        : 0;
    targetPattern.projects = Array.isArray(targetPattern.project_ids) ? targetPattern.project_ids.length : 0;
    targetPattern.first_seen =
      [targetPattern.first_seen, sourcePattern.first_seen]
        .filter((value): value is string => typeof value === "string")
        .sort()[0] || null;
    targetPattern.last_seen =
      [targetPattern.last_seen, sourcePattern.last_seen]
        .filter((value): value is string => typeof value === "string")
        .sort()
        .at(-1) || null;
    targetPattern.high_value = Boolean(targetPattern.high_value || sourcePattern.high_value);
    migrated += 1;
  }
  await writeJson(targetFile, { schema_version: 1, patterns: targetIndex.patterns });
  return migrated;
}

async function migrateCandidatesFromSource(
  source: string,
  target: string,
  conflicts: MigrationConflict[],
): Promise<number> {
  const sourceDir = path.join(source, "candidates");
  const targetDir = path.join(target, "candidates");
  let migrated = 0;
  for (const file of await fs.readdir(sourceDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const candidate = await readJson<JsonRecord>(path.join(sourceDir, file));
    if (!isRecord(candidate)) continue;
    const targetFile = path.join(targetDir, file);
    const existing = await readJson<JsonRecord>(targetFile);
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
        recommended_resolution: "review duplicate candidate before merging",
      });
    }
  }
  return migrated;
}

async function migrateSkillsFromSource(
  source: string,
  target: string,
  conflicts: MigrationConflict[],
): Promise<number> {
  const sourceDir = path.join(source, "skills");
  const targetDir = path.join(target, "skills");
  let migrated = 0;
  for (const dir of await fs.readdir(sourceDir).catch(() => [])) {
    const sourceSkill = path.join(sourceDir, dir);
    const targetSkill = path.join(targetDir, dir);
    const sourceMeta = await readJson<JsonRecord>(path.join(sourceSkill, "skill.json"));
    if (!isRecord(sourceMeta)) continue;
    const targetMeta = await readJson<JsonRecord>(path.join(targetSkill, "skill.json"));
    if (!targetMeta) {
      await fs.cp(sourceSkill, targetSkill, { recursive: true, force: false });
      migrated += 1;
      continue;
    }
    const sourceContent = await fs.readFile(path.join(sourceSkill, "SKILL.md"), "utf8").catch(() => "");
    const targetContent = await fs.readFile(path.join(targetSkill, "SKILL.md"), "utf8").catch(() => "");
    if (sameJson(targetMeta, sourceMeta) || sourceContent === targetContent) continue;
    conflicts.push({
      type: "skill",
      source,
      id: dir,
      recommended_resolution: "manual merge required; target skill was not overwritten",
    });
  }
  return migrated;
}

async function migrateSharedKnowledge(hostHome: string): Promise<MigrationReport> {
  const knowledgeHome = await resolveKnowledgeHome();
  await ensureKnowledgeDirs(knowledgeHome);
  const conflicts: MigrationConflict[] = [];
  const migrated = { patterns: 0, candidates: 0, skills: 0 };
  const sources = (await sourceHomes(hostHome)).filter(
    (source) => path.resolve(source) !== path.resolve(knowledgeHome),
  );
  for (const source of sources) {
    migrated.patterns += await migratePatternsFromSource(source, knowledgeHome);
    migrated.candidates += await migrateCandidatesFromSource(source, knowledgeHome, conflicts);
    migrated.skills += await migrateSkillsFromSource(source, knowledgeHome, conflicts);
  }
  const report = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    sources,
    migrated,
    conflicts,
  };
  await writeJson(path.join(await knowledgeDirPath("indexes"), "migration-report.json"), report);
  return report;
}

export async function migrationStatus() {
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
    config_path: path.join(anchorHome, "config.json"),
  };
}

export async function handleHubMigrate(args: HubMigrateArgs = {}) {
  const status = await migrationStatus();
  const counts = {
    activities: await countJsonFiles(status.hub, "activities"),
    candidates: await countJsonFiles(status.knowledge_path, "candidates"),
    skills: (await fs.readdir(path.join(status.knowledge_path, "skills")).catch(() => [])).length,
  };
  if (!status.migration_required) return { ...status, dry_run: Boolean(args.dry_run), migrated: false, counts };
  if (args.dry_run || args.confirm !== true) {
    return { ...status, dry_run: true, migrated: false, counts, action: "confirm_required" };
  }

  const backup = await backupHub(status.hub);
  try {
    const shared_knowledge = await migrateSharedKnowledge(status.hub);
    const migrated = {
      activities: await migrateActivities(status.hub),
      candidates: await migrateCandidates(status.knowledge_path),
      skills: await migrateSkills(status.knowledge_path),
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
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
