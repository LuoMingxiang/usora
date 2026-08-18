import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

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
const runtimePluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const isCodeBuddyInstall = runtimePluginRoot
  .toLowerCase()
  .includes(path.join(".codebuddy", "plugins", "marketplaces").toLowerCase());

export const anchorHome = process.env.CODEBUDDY_PLUGIN_DATA
  ? path.resolve(process.env.CODEBUDDY_PLUGIN_DATA, ".usora")
  : process.env.PLUGIN_DATA
    ? path.resolve(process.env.PLUGIN_DATA, ".usora")
    : process.env.CODEBUDDY_PLUGIN_ROOT || isCodeBuddyInstall
      ? path.join(os.homedir(), ".codebuddy", "plugins", "data", "usora", ".usora")
      : path.resolve(process.cwd(), ".usora");

/**
 * Resolve the absolute path to the local data Hub.
 *
 * Defaults to the anchor directory; once the user relocates via `hub_config` (`hub_path`), that directory is used
 * instead.
 *
 * @param {object} [config] - Loaded Hub config, if already available.
 * @returns {Promise<string>} Absolute Hub path.
 */
export async function resolveHome(config) {
  const cfg = config || (await loadConfig());
  return cfg.hub_path ? path.resolve(cfg.hub_path) : anchorHome;
}

/**
 * Process-scoped session id.
 *
 * Time-sortable and collision-resistant: a 48-bit millisecond timestamp plus a 128-bit random salt. Used as the
 * fallback `session_id` so repeated captures within one MCP process merge into a single Activity.
 *
 * @type {string}
 */
export const processSessionId = `session-${Date.now().toString(16).padStart(12, "0")}-${crypto.randomBytes(16).toString("hex")}`;

/**
 * Sub-directories created under the Hub root.
 *
 * @type {string[]}
 */
export const DIRS = ["activities", "candidates", "skills", "archive", "events"];

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
export const newId = (prefix) => `${prefix}-${crypto.randomBytes(5).toString("hex")}`;

/**
 * Resolve a path inside the Hub root.
 *
 * @param {string} dir - Sub-directory name.
 * @returns {Promise<string>} Absolute path within the Hub.
 */
export async function dirPath(dir) {
  return path.join(await resolveHome(), dir);
}

/**
 * Create every Hub sub-directory (idempotent).
 *
 * @returns {Promise<void>}
 */
export async function ensure() {
  const home = await resolveHome();
  await Promise.all(DIRS.map((dir) => fs.mkdir(path.join(home, dir), { recursive: true })));
}

/**
 * Read and parse a JSON file, returning `fallback` when it is missing or invalid.
 *
 * @template T
 * @param {string} file - Path to the JSON file.
 * @param {T} [fallback=null] - Value returned on read/parse failure. Default is `null`
 * @returns {Promise<T | null>}
 */
export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Atomically write an object as pretty-printed JSON (write to temp + rename).
 *
 * @param {string} file - Destination path.
 * @param {any} value - Serializable value.
 * @returns {Promise<void>}
 */
export async function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

/**
 * Persist a lifecycle event with a timestamp.
 *
 * @param {string} type - Event type (e.g. "ActivityCreated").
 * @param {any} data - Event payload.
 * @returns {Promise<void>}
 */
export async function writeEvent(type, data) {
  const file = path.join(await dirPath("events"), `${Date.now()}-${newId("event")}.json`);
  await writeJson(file, { type, timestamp: now(), data });
}

/**
 * Load Hub configuration, applying defaults when it does not exist.
 *
 * Always read from the fixed `anchorHome` so the config is discoverable regardless of where the user's data directory
 * lives.
 *
 * @returns {Promise<{ maintainer: string; automation_policy: string; version: number; hub_path?: string }>}
 */
export async function loadConfig() {
  return readJson(path.join(anchorHome, "config.json"), {
    maintainer: "codex",
    automation_policy: "manual_approval",
    version: 1,
  });
}

/**
 * Persist Hub configuration, guaranteeing a numeric `version`.
 *
 * @param {object} value - Config object to save.
 * @returns {Promise<object>} The saved config (with normalized `version`).
 */
export async function saveConfig(value) {
  const next = { ...value, version: value.version || 1 };
  await fs.mkdir(anchorHome, { recursive: true });
  await writeJson(path.join(anchorHome, "config.json"), next);
  return next;
}
