import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createUsoraEvent, normalizeEventType } from "@usora/integration";

// ---------------------------------------------------------------------------
// Storage primitives
// ---------------------------------------------------------------------------

/**
 * Anchor directory that always holds `config.json`.
 *
 * This must be a _fixed_ location so the config can be found before it has told us where the user wants their data.
 * Host-provided plugin data directories keep Usora out of the user's project; local development falls back to
 * `<cwd>/.usora`.
 *
 * @type {string}
 */
const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const runtimePluginRoot =
  path.basename(runtimeDir) === "dist" ? path.resolve(runtimeDir, "..") : path.resolve(runtimeDir, "..", "..");
const lowerRuntimePluginRoot = runtimePluginRoot.toLowerCase();
const isCodeBuddyInstall = lowerRuntimePluginRoot.includes(
  path.join(".codebuddy", "plugins", "marketplaces").toLowerCase(),
);
const isCodexInstall = lowerRuntimePluginRoot.includes(path.join(".codex", "plugins", "cache").toLowerCase());

export const anchorHome = process.env.CODEBUDDY_PLUGIN_DATA
  ? path.resolve(process.env.CODEBUDDY_PLUGIN_DATA, ".usora")
  : process.env.PLUGIN_DATA
    ? path.resolve(process.env.PLUGIN_DATA, ".usora")
    : process.env.CODEBUDDY_PLUGIN_ROOT || isCodeBuddyInstall
      ? path.join(os.homedir(), ".codebuddy", "plugins", "data", "usora", ".usora")
      : process.env.CLAUDE_PLUGIN_ROOT || isCodexInstall
        ? path.join(os.homedir(), ".codex", "plugins", "data", "usora", ".usora")
        : path.resolve(process.cwd(), ".usora");

export type PathResolutionSource = "environment" | "config" | "host_plugin_data" | "default" | "development";

export const hostHome = anchorHome;

export const hostHomeSource: PathResolutionSource =
  process.env.CODEBUDDY_PLUGIN_DATA || process.env.PLUGIN_DATA
    ? "host_plugin_data"
    : process.env.CODEBUDDY_PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || isCodeBuddyInstall || isCodexInstall
      ? "host_plugin_data"
      : "development";

export const knowledgeHome = process.env.USORA_HOME
  ? path.resolve(process.env.USORA_HOME)
  : hostHomeSource === "development"
    ? anchorHome
    : path.join(os.homedir(), ".usora");

export const _knowledgeHomeSource: PathResolutionSource = process.env.USORA_HOME
  ? "environment"
  : hostHomeSource === "development"
    ? "development"
    : "default";

/**
 * Process-scoped session id.
 *
 * Time-sortable and collision-resistant: a 48-bit millisecond timestamp plus a 128-bit random salt. Used as the
 * fallback `session_id` so repeated captures within one MCP process merge into a single Activity.
 *
 * @type {string}
 */
export const processSessionId = `session-${Date.now().toString(16).padStart(12, "0")}-${crypto.randomBytes(16).toString("hex")}`;

export const HUB_SCHEMA_VERSION = 2;
export const ACTIVITY_SCHEMA_VERSION = 2;
export const SESSION_RECORD_SCHEMA_VERSION = 1;
export const CANDIDATE_SCHEMA_VERSION = 2;
export const PATTERN_SCHEMA_VERSION = 1;
export const SKILL_METADATA_SCHEMA_VERSION = 2;
export const EVENT_SCHEMA_VERSION = 1;

/**
 * Sub-directories created under the Hub root.
 *
 * @type {string[]}
 */
export const DIRS = [
  "activities",
  "candidates",
  "skills",
  "usage",
  "archive",
  "events",
  "sessions",
  "indexes",
  "backups",
];

export const HOST_DIRS = ["activities", "sessions", "runtime", "archive"];
export const KNOWLEDGE_DIRS = ["candidates", "skills", "usage", "archive", "events", "indexes", "backups"];

/**
 * Valid values for `config.automation_policy`.
 *
 * @type {string[]}
 */
export const AUTOMATION_POLICIES = ["auto_publish", "manual_approval", "auto_generate_manual_publish"];

/**
 * Activity states eligible for archival by `hub_cleanup` (`generated` mode).
 *
 * @type {string[]}
 */
export const ARCHIVABLE_STATES = ["PROCESSED", "USED", "ABSORBED"];

type JsonObject = Record<string, unknown>;

export type HubConfig = JsonObject & {
  maintainer: string;
  automation_policy: string;
  version: number;
  hub_schema_version: number;
  hub_path?: string;
  intelligence?: JsonObject;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Current UTC timestamp as an ISO 8601 string.
 *
 * @returns {string}
 */
export const now = () => new Date().toISOString();

/**
 * Build a unique id from a type prefix and a random hex suffix.
 *
 * @param {string} prefix - Human-readable type prefix (e.g. "activity").
 * @returns {string} E.g. `activity-520ac7c464`.
 */
export const newId = (prefix: string) => `${prefix}-${crypto.randomBytes(5).toString("hex")}`;

/**
 * Resolve the absolute path to the local data Hub.
 *
 * Defaults to the anchor directory; once the user relocates via `hub_config` (`hub_path`), that directory is used
 * instead.
 */
export async function resolveHome(config?: Partial<HubConfig>): Promise<string> {
  const cfg = config || (await loadConfig());
  return typeof cfg.hub_path === "string" && cfg.hub_path ? path.resolve(cfg.hub_path) : anchorHome;
}

export async function resolveHostHome(config?: Partial<HubConfig>): Promise<string> {
  return resolveHome(config);
}

export async function resolveKnowledgeHome(): Promise<string> {
  return knowledgeHome;
}

/**
 * Resolve a path inside the Hub root.
 *
 * @param {string} dir - Sub-directory name.
 * @returns {Promise<string>} Absolute path within the Hub.
 */
export async function dirPath(dir: string): Promise<string> {
  return path.join(await resolveHome(), dir);
}

export async function hostDirPath(dir: string): Promise<string> {
  return path.join(await resolveHostHome(), dir);
}

export async function knowledgeDirPath(dir: string): Promise<string> {
  return path.join(await resolveKnowledgeHome(), dir);
}

/**
 * Create every Hub sub-directory (idempotent).
 *
 * @returns {Promise<void>}
 */
export async function ensure(): Promise<void> {
  const host = await resolveHostHome();
  const knowledge = await resolveKnowledgeHome();
  await Promise.all([
    ...HOST_DIRS.map((dir) => fs.mkdir(path.join(host, dir), { recursive: true })),
    ...KNOWLEDGE_DIRS.map((dir) => fs.mkdir(path.join(knowledge, dir), { recursive: true })),
  ]);
}

/**
 * Read and parse a JSON file, returning `fallback` when it is missing or invalid.
 *
 * @template T
 * @param {string} file - Path to the JSON file.
 * @param {T} [fallback=null] - Value returned on read/parse failure. Default is `null`
 * @returns {Promise<T | null>}
 */
export async function readJson<T = unknown>(file: string, fallback: T | null = null): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!!rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

async function copyHubData(sourceHome: string, targetHome: string): Promise<void> {
  if (path.resolve(sourceHome) === path.resolve(targetHome)) return;
  for (const dir of DIRS) {
    const src = path.join(sourceHome, dir);
    if (!(await exists(src))) continue;
    await fs.mkdir(path.join(targetHome, dir), { recursive: true });
    await fs.cp(src, path.join(targetHome, dir), { recursive: true, force: false, errorOnExist: false });
  }
}

async function migrateLegacyConfig(): Promise<HubConfig | null> {
  const currentConfig = path.join(anchorHome, "config.json");
  if (await exists(currentConfig)) return null;

  const legacyHomes = [path.join(runtimePluginRoot, ".usora"), path.resolve(process.cwd(), ".usora")];
  for (const legacyHome of legacyHomes) {
    const config = await readJson<JsonObject>(path.join(legacyHome, "config.json"));
    if (!isObject(config)) continue;

    const legacyHub =
      typeof config.hub_path === "string" && config.hub_path ? path.resolve(config.hub_path) : legacyHome;
    if (legacyHome !== path.join(runtimePluginRoot, ".usora") && !isInside(runtimePluginRoot, legacyHub)) continue;

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

/**
 * Atomically write an object as pretty-printed JSON (write to temp + rename).
 *
 * @param {string} file - Destination path.
 * @param {any} value - Serializable value.
 * @returns {Promise<void>}
 */
export async function writeJson(file: string, value: unknown): Promise<void> {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

/**
 * Persist a lifecycle event.
 *
 * @param {string} type - Event type (e.g. "activity.created").
 * @param {any} data - Event payload.
 * @returns {Promise<void>}
 */
export async function writeEvent(type: string, data: unknown): Promise<void> {
  const id = newId("event");
  const normalizedType = normalizeEventType(type);
  const file = path.join(await knowledgeDirPath("events"), `${Date.now()}-${id}.json`);
  await writeJson(
    file,
    createUsoraEvent({
      id,
      schemaVersion: EVENT_SCHEMA_VERSION,
      type: normalizedType,
      occurredAt: now(),
      producer: { plugin: "foundry" },
      data,
      ...(normalizedType === type ? {} : { metadata: { legacyType: type } }),
    }),
  );
}

/**
 * Load Hub configuration, applying defaults when it does not exist.
 *
 * Always read from the fixed `anchorHome` so the config is discoverable regardless of where the user's data directory
 * lives.
 *
 * @returns {Promise<{ maintainer: string; automation_policy: string; version: number; hub_path?: string }>}
 */
function normalizeConfig(value: JsonObject): HubConfig {
  return {
    maintainer: typeof value.maintainer === "string" ? value.maintainer : "codex",
    automation_policy: typeof value.automation_policy === "string" ? value.automation_policy : "manual_approval",
    ...value,
    version: typeof value.version === "number" ? value.version : HUB_SCHEMA_VERSION,
    hub_schema_version:
      typeof value.hub_schema_version === "number"
        ? value.hub_schema_version
        : typeof value.version === "number"
          ? value.version
          : HUB_SCHEMA_VERSION,
    intelligence: {
      candidate_min_occurrences: 2,
      ...(isObject(value.intelligence) ? value.intelligence : {}),
    },
  };
}

export async function loadConfig(): Promise<HubConfig> {
  const migrated = await migrateLegacyConfig();
  if (migrated) return migrated;
  const config = await readJson<JsonObject>(path.join(anchorHome, "config.json"), {
    maintainer: "codex",
    automation_policy: "manual_approval",
    version: HUB_SCHEMA_VERSION,
    hub_schema_version: HUB_SCHEMA_VERSION,
    intelligence: { candidate_min_occurrences: 2 },
  });
  return normalizeConfig(config || {});
}

/**
 * Persist Hub configuration, guaranteeing a numeric `version`.
 *
 * @param {object} value - Config object to save.
 * @returns {Promise<object>} The saved config (with normalized `version`).
 */
export async function saveConfig(value: JsonObject): Promise<HubConfig> {
  const next = normalizeConfig(value);
  await fs.mkdir(anchorHome, { recursive: true });
  await writeJson(path.join(anchorHome, "config.json"), next);
  return next;
}
