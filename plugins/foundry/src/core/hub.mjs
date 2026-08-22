import fs from "node:fs/promises";
import path from "node:path";
import {
  ARCHIVABLE_STATES,
  AUTOMATION_POLICIES,
  DIRS,
  HUB_SCHEMA_VERSION,
  anchorHome,
  dirPath,
  loadConfig,
  readJson,
  resolveHome,
  saveConfig,
} from "./storage.mjs";
import { migrationStatus } from "./migration.mjs";

export async function handleHubInit(args = {}) {
  const config = await loadConfig();
  if ((config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION) {
    return { ...(await migrationStatus()), initialized: false, action: "migration_required" };
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
  const home = await resolveHome(saved);
  await fs.mkdir(home, { recursive: true });
  await Promise.all(DIRS.map((dir) => fs.mkdir(path.join(home, dir), { recursive: true })));
  return {
    initialized: true,
    hub: home,
    data_path: home,
    config_path: path.join(anchorHome, "config.json"),
    hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION,
    maintainer: saved.maintainer,
    automation_policy: saved.automation_policy,
  };
}

/**
 * `hub_config`: update the Maintainer, automation policy, and/or relocate the data directory.
 *
 * When `path` is supplied, the existing Hub data is MOVED to the new directory: every existing sub-directory's contents
 * are migrated, and the old directory's contents are cleared. `path` may be absolute or relative to the workspace.
 *
 * @param {ToolArgs} args - May contain `path`, `maintainer`, `automation_policy`.
 * @returns {Promise<object>} The updated config (with `hub` and `moved_from` when relocating).
 * @throws {Error} When `automation_policy` is not a valid value.
 */
export async function handleHubConfig(args) {
  const config = await loadConfig();
  const oldHome = await resolveHome(config);
  const newHome = args.path !== undefined ? path.resolve(args.path) : oldHome;

  if (args.maintainer !== undefined) {
    config.maintainer = args.maintainer;
  }
  if (args.automation_policy !== undefined) {
    if (!AUTOMATION_POLICIES.includes(args.automation_policy)) {
      throw Error("invalid automation_policy");
    }
    config.automation_policy = args.automation_policy;
  }

  // Relocate: move data from the old directory to the new one, then clear it.
  let movedFrom = null;
  if (args.path !== undefined && newHome !== oldHome) {
    movedFrom = oldHome;
    await fs.mkdir(newHome, { recursive: true });
    for (const dir of DIRS) {
      const src = path.join(oldHome, dir);
      const dst = path.join(newHome, dir);
      await fs.mkdir(dst, { recursive: true });
      for (const entry of await fs.readdir(src).catch(() => [])) {
        await fs.rename(path.join(src, entry), path.join(dst, entry));
      }
      await fs.rm(src, { recursive: true, force: true });
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
      config_path: path.join(anchorHome, "config.json"),
      hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION,
    };
  }
  return {
    ...saved,
    hub: await resolveHome(saved),
    data_path: await resolveHome(saved),
    config_path: path.join(anchorHome, "config.json"),
    hub_schema_version: saved.hub_schema_version || HUB_SCHEMA_VERSION,
  };
}

/**
 * `hub_status`: report config and record counts without loading records.
 *
 * @returns {Promise<object>} Hub path, config, and per-collection counts.
 */
export async function handleHubStatus() {
  const config = await loadConfig();
  const home = await resolveHome(config);
  const count = async (dir) => (await fs.readdir(await dirPath(dir)).catch(() => [])).length;
  const activities = await count("activities");
  const candidates = await count("candidates");
  const skills = await count("skills");
  const nextAction =
    activities === 0
      ? "capture_activity"
      : candidates === 0
        ? "create_candidate"
        : skills === 0
          ? "create_skill"
          : "review_or_cleanup";
  return {
    hub: home,
    data_path: home,
    config_path: path.join(anchorHome, "config.json"),
    config,
    hub_schema_version: config.hub_schema_version || HUB_SCHEMA_VERSION,
    migration_required: (config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION,
    activities,
    candidates,
    skills,
    next_action: nextAction,
  };
}

/**
 * `hub_cleanup`: dispatch to `cleanAll` or `archiveGenerated` by mode.
 *
 * @param {ToolArgs} args - `mode` ("generated"|"all") and `confirm` (required when `mode` is "all").
 * @returns {Promise<object>} Cleanup result.
 * @throws {Error} On an invalid mode, or "all" without `confirm: true`.
 */
export async function handleHubCleanup(args) {
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

/**
 * Irreversibly delete every Hub record, Skill, archive, and event.
 *
 * The data directory and its sub-directories are recreated empty, and the config file (including `hub_path`) is kept so
 * the user can still discover where their data lives after a cleanup/uninstall.
 *
 * @returns {Promise<object>} Per-collection deletion counts and the Hub path.
 */
async function cleanAll() {
  const home = await resolveHome();
  const counts = {};
  for (const dir of DIRS) {
    const target = path.join(home, dir);
    const files = await fs.readdir(target).catch(() => []);
    counts[dir] = files.length;
    await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(target, { recursive: true });
  }
  return {
    mode: "all",
    counts,
    hub: home,
    data_path: home,
    config_path: path.join(anchorHome, "config.json"),
    action: "deleted_all_hub_data",
  };
}

/**
 * Move processed/absorbed Activities into the archive directory.
 *
 * @returns {Promise<object>} Number of Activities archived.
 */
async function archiveGenerated() {
  let archived = 0;
  const activitiesDir = await dirPath("activities");
  const archiveDir = await dirPath("archive");
  for (const file of await fs.readdir(activitiesDir)) {
    if (!file.endsWith(".json")) continue;
    const source = path.join(activitiesDir, file);
    const item = await readJson(source);
    if (ARCHIVABLE_STATES.includes(item?.state) || item?.skill_id) {
      await fs.rename(source, path.join(archiveDir, file));
      archived++;
    }
  }
  return { mode: "generated", archived, action: "archived_generated_activities" };
}

/**
 * `hub_doctor`: run a lightweight local Hub health check.
 *
 * @returns {Promise<object>} Health summary, counts, and repair hints.
 */
export async function handleHubDoctor() {
  const config = await loadConfig();
  const home = await resolveHome(config);
  const counts = {};
  const checks = [];
  for (const dir of DIRS) {
    const target = path.join(home, dir);
    try {
      counts[dir] = (await fs.readdir(target)).length;
      checks.push({ name: `${dir}_dir`, ok: true, path: target });
    } catch (err) {
      counts[dir] = 0;
      checks.push({ name: `${dir}_dir`, ok: false, path: target, message: err.message });
    }
  }
  const skillDirs = await fs.readdir(path.join(home, "skills")).catch(() => []);
  const orphanSkills = [];
  for (const dir of skillDirs) {
    const meta = await readJson(path.join(home, "skills", dir, "skill.json"));
    if (!meta) orphanSkills.push(dir);
  }
  checks.push({ name: "skill_metadata", ok: orphanSkills.length === 0, orphan_skills: orphanSkills });
  return {
    ok: checks.every((check) => check.ok),
    hub: home,
    data_path: home,
    config_path: path.join(anchorHome, "config.json"),
    hub_schema_version: config.hub_schema_version || HUB_SCHEMA_VERSION,
    migration_required: (config.hub_schema_version || config.version || HUB_SCHEMA_VERSION) < HUB_SCHEMA_VERSION,
    config,
    counts,
    checks,
  };
}
