import fs from "node:fs/promises";
import path from "node:path";
import {
  ACTIVITY_SCHEMA_VERSION,
  CANDIDATE_SCHEMA_VERSION,
  DIRS,
  HUB_SCHEMA_VERSION,
  SKILL_METADATA_SCHEMA_VERSION,
  anchorHome,
  loadConfig,
  readJson,
  resolveHome,
  saveConfig,
  writeEvent,
  writeJson,
} from "./storage.mjs";

export function needsMigration(config) {
  return Number(config?.hub_schema_version || config?.version || 1) < HUB_SCHEMA_VERSION;
}

async function countJsonFiles(home, dir) {
  const root = path.join(home, dir);
  let count = 0;
  for (const file of await fs.readdir(root).catch(() => [])) {
    if (file.endsWith(".json")) count += 1;
  }
  return count;
}

async function backupHub(home) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(home, "backups", `migration-v1-to-v2-${stamp}`);
  await fs.mkdir(backup, { recursive: true });
  for (const dir of DIRS) {
    if (dir === "backups") continue;
    await fs.cp(path.join(home, dir), path.join(backup, dir), { recursive: true, force: true });
  }
  await fs.cp(path.join(anchorHome, "config.json"), path.join(backup, "config.json"), { force: true });
  return backup;
}

async function restoreHub(home, backup) {
  for (const dir of DIRS) {
    if (dir === "backups") continue;
    await fs.rm(path.join(home, dir), { recursive: true, force: true });
    await fs.cp(path.join(backup, dir), path.join(home, dir), { recursive: true, force: true });
  }
  await fs.cp(path.join(backup, "config.json"), path.join(anchorHome, "config.json"), { force: true });
}

async function migrateActivities(home) {
  const root = path.join(home, "activities");
  let count = 0;
  for (const file of await fs.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(root, file));
    if (!item) continue;
    item.schema_version = ACTIVITY_SCHEMA_VERSION;
    item.state ||= "NEW";
    item.recent_updates ||= item.updates || [];
    delete item.updates;
    item.history ||= {
      update_count: item.recent_updates.length,
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

async function migrateCandidates(home) {
  const root = path.join(home, "candidates");
  let count = 0;
  for (const file of await fs.readdir(root).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(root, file));
    if (!item) continue;
    item.schema_version = CANDIDATE_SCHEMA_VERSION;
    item.domain ||= null;
    item.topic ||= null;
    item.tags ||= [];
    item.technologies ||= [];
    item.fingerprint ||= null;
    item.occurrences ||= Array.isArray(item.evidence) ? item.evidence.length || 1 : 1;
    item.confidence ??= null;
    item.evidence = (item.evidence || []).map((evidence) =>
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

async function migrateSkills(home) {
  const root = path.join(home, "skills");
  let count = 0;
  for (const dir of await fs.readdir(root).catch(() => [])) {
    const file = path.join(root, dir, "skill.json");
    const item = await readJson(file);
    if (!item) continue;
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

export async function migrationStatus() {
  const config = await loadConfig();
  const home = await resolveHome(config);
  return {
    migration_required: needsMigration(config),
    from_schema_version: Number(config.hub_schema_version || config.version || 1),
    to_schema_version: HUB_SCHEMA_VERSION,
    hub: home,
    data_path: home,
    config_path: path.join(anchorHome, "config.json"),
  };
}

export async function handleHubMigrate(args = {}) {
  const status = await migrationStatus();
  const counts = {
    activities: await countJsonFiles(status.hub, "activities"),
    candidates: await countJsonFiles(status.hub, "candidates"),
    skills: (await fs.readdir(path.join(status.hub, "skills")).catch(() => [])).length,
  };
  if (!status.migration_required) return { ...status, dry_run: Boolean(args.dry_run), migrated: false, counts };
  if (args.dry_run || args.confirm !== true) {
    return { ...status, dry_run: true, migrated: false, counts, action: "confirm_required" };
  }

  const backup = await backupHub(status.hub);
  try {
    const migrated = {
      activities: await migrateActivities(status.hub),
      candidates: await migrateCandidates(status.hub),
      skills: await migrateSkills(status.hub),
    };
    const config = await loadConfig();
    await saveConfig({ ...config, version: HUB_SCHEMA_VERSION, hub_schema_version: HUB_SCHEMA_VERSION });
    const result = { ...status, migration_required: false, migrated: true, backup, counts: migrated };
    await writeEvent("HubMigrated", result);
    return result;
  } catch (err) {
    await restoreHub(status.hub, backup);
    await writeEvent("HubMigrationFailed", { ...status, backup, error: err.message });
    throw err;
  }
}
