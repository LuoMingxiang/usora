#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import crypto from "node:crypto";

/**
 * Usora MCP server.
 *
 * A local-first JSON-RPC (stdio) server exposing the Usora tool surface:
 * Hub lifecycle, Activity capture, Candidate review, and Skill publication.
 *
 * @module usora-mcp
 */

// ---------------------------------------------------------------------------
// Storage primitives
// ---------------------------------------------------------------------------

/**
 * Absolute path to the local Hub.
 *
 * Codex restricts a local MCP server to the active workspace, so the default
 * Hub lives under `<cwd>/.usora`. Set `USORA_HOME` to share one Hub across
 * workspaces or AI clients.
 *
 * @type {string}
 */
const home = path.resolve(process.env.USORA_HOME || path.join(process.cwd(), ".usora"));

/**
 * Process-scoped session id.
 *
 * Time-sortable and collision-resistant: a 48-bit millisecond timestamp plus
 * a 128-bit random salt. Used as the fallback `session_id` so repeated
 * captures within one MCP process merge into a single Activity.
 *
 * @type {string}
 */
const processSessionId = `session-${Date.now().toString(16).padStart(12, "0")}-${crypto.randomBytes(16).toString("hex")}`;

/**
 * Sub-directories created under the Hub root.
 * @type {string[]}
 */
const DIRS = ["activities", "candidates", "skills", "archive", "events"];

/**
 * Valid values for `config.automation_policy`.
 * @type {string[]}
 */
const AUTOMATION_POLICIES = ["auto_publish", "manual_approval", "auto_generate_manual_publish"];

/**
 * Activity states eligible for archival by `hub_cleanup` (`generated` mode).
 * @type {string[]}
 */
const ARCHIVABLE_STATES = ["PROCESSED", "USED", "ABSORBED"];

/**
 * Current UTC timestamp as an ISO 8601 string.
 * @returns {string}
 */
const now = () => new Date().toISOString();

/**
 * Build a unique id from a type prefix and a random hex suffix.
 * @param {string} prefix - Human-readable type prefix (e.g. "activity").
 * @returns {string} e.g. `activity-520ac7c464`.
 */
const newId = prefix => `${prefix}-${crypto.randomBytes(5).toString("hex")}`;

/**
 * Resolve a path inside the Hub root.
 * @param {string} dir - Sub-directory name.
 * @returns {string} Absolute path within the Hub.
 */
function dirPath(dir) {
  return path.join(home, dir);
}

/**
 * Create every Hub sub-directory (idempotent).
 * @returns {Promise<void>}
 */
async function ensure() {
  await Promise.all(DIRS.map(dir => fs.mkdir(dirPath(dir), { recursive: true })));
}

/**
 * Read and parse a JSON file, returning `fallback` when it is missing or invalid.
 * @template T
 * @param {string} file - Path to the JSON file.
 * @param {T} [fallback=null] - Value returned on read/parse failure.
 * @returns {Promise<T|null>}
 */
async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Atomically write an object as pretty-printed JSON (write to temp + rename).
 * @param {string} file - Destination path.
 * @param {*} value - Serializable value.
 * @returns {Promise<void>}
 */
async function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(tmp, file);
}

/**
 * Persist a lifecycle event with a timestamp.
 * @param {string} type - Event type (e.g. "ActivityCreated").
 * @param {*} data - Event payload.
 * @returns {Promise<void>}
 */
async function writeEvent(type, data) {
  const file = path.join(dirPath("events"), `${Date.now()}-${newId("event")}.json`);
  await writeJson(file, { type, timestamp: now(), data });
}

/**
 * Load Hub configuration, applying defaults when it does not exist.
 * @returns {Promise<{maintainer: string, automation_policy: string, version: number}>}
 */
async function loadConfig() {
  return readJson(path.join(home, "config.json"), {
    maintainer: "codex",
    automation_policy: "manual_approval",
    version: 1,
  });
}

/**
 * Persist Hub configuration, guaranteeing a numeric `version`.
 * @param {object} value - Config object to save.
 * @returns {Promise<object>} The saved config (with normalized `version`).
 */
async function saveConfig(value) {
  const next = { ...value, version: value.version || 1 };
  await writeJson(path.join(home, "config.json"), next);
  return next;
}

/**
 * Assert that a value is a non-empty string and return it.
 * @param {*} value - Value to validate.
 * @param {string} field - Field name used in the error message.
 * @returns {string}
 * @throws {Error} When `value` is not a string.
 */
function requireString(value, field) {
  if (typeof value !== "string") {
    throw Error(`${field} is required`);
  }
  return value;
}

/**
 * Validate a name against a safe, filesystem-friendly format
 * (`letters, numbers, hyphens` only, up to 64 chars).
 *
 * @param {*} value - Candidate name.
 * @param {string} field - Field name used in the error message.
 * @returns {string} The validated name.
 * @throws {Error} When the name is not a string or fails the format check.
 */
function safeName(value, field) {
  requireString(value, field);
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(value)) {
    throw Error(`${field} must contain only letters, numbers, and hyphens`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Activity helpers
// ---------------------------------------------------------------------------

/**
 * Find the Activity record (and its filename) for a given session id.
 *
 * @param {string} sessionId - Session id to look up.
 * @returns {Promise<{file: string, item: object}|null>} Match, or `null` if none.
 */
async function findActivityBySession(sessionId) {
  const dir = dirPath("activities");
  for (const file of await fs.readdir(dir)) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(dir, file));
    if (item?.session_id === sessionId) return { file, item };
  }
  return null;
}

/**
 * Merge two arrays into one de-duplicated array, preserving order.
 * @param {*[]|undefined} left - Base array.
 * @param {*[]|undefined} right - Additional values to append.
 * @returns {*[]} Unique values from `left` followed by new values from `right`.
 */
function mergeUnique(left, right) {
  return [...new Set([...(left || []), ...(right || [])])];
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

/**
 * Tool arguments, as received from the MCP client.
 * @typedef {Object<string, *>} ToolArgs
 */

/**
 * `hub_init`: ensure storage exists and the config file is present.
 *
 * Never creates sample data.
 *
 * @returns {Promise<{hub: string, initialized: boolean}>}
 */
async function handleHubInit() {
  const config = await loadConfig();
  await saveConfig(config);
  return { hub: home, initialized: true };
}

/**
 * `hub_config`: update the Maintainer and/or automation policy.
 *
 * @param {ToolArgs} args - May contain `maintainer` and `automation_policy`.
 * @returns {Promise<object>} The updated config.
 * @throws {Error} When `automation_policy` is not a valid value.
 */
async function handleHubConfig(args) {
  const config = await loadConfig();
  if (args.maintainer !== undefined) {
    config.maintainer = args.maintainer;
  }
  if (args.automation_policy !== undefined) {
    if (!AUTOMATION_POLICIES.includes(args.automation_policy)) {
      throw Error("invalid automation_policy");
    }
    config.automation_policy = args.automation_policy;
  }
  return saveConfig(config);
}

/**
 * `hub_status`: report config and record counts without loading records.
 *
 * @returns {Promise<object>} Hub path, config, and per-collection counts.
 */
async function handleHubStatus() {
  const count = dir => fs.readdir(dirPath(dir)).then(files => files.length);
  return {
    hub: home,
    config: await loadConfig(),
    activities: await count("activities"),
    candidates: await count("candidates"),
    skills: await count("skills"),
  };
}

/**
 * `hub_cleanup`: dispatch to `cleanAll` or `archiveGenerated` by mode.
 *
 * @param {ToolArgs} args - `mode` ("generated"|"all") and `confirm` (required
 *   when `mode` is "all").
 * @returns {Promise<object>} Cleanup result.
 * @throws {Error} On an invalid mode, or "all" without `confirm: true`.
 */
async function handleHubCleanup(args) {
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
 * Irreversibly delete every Hub record, Skill, archive, event, and config.
 *
 * @returns {Promise<object>} Per-collection deletion counts.
 */
async function cleanAll() {
  const counts = {};
  for (const dir of DIRS) {
    const target = dirPath(dir);
    const files = await fs.readdir(target);
    counts[dir] = files.length;
    await fs.rm(target, { recursive: true, force: true });
    await fs.mkdir(target, { recursive: true });
  }
  try {
    await fs.unlink(path.join(home, "config.json"));
    counts.config = 1;
  } catch {
    counts.config = 0;
  }
  return { mode: "all", counts, action: "deleted_all_hub_data" };
}

/**
 * Move processed/absorbed Activities into the archive directory.
 *
 * @returns {Promise<object>} Number of Activities archived.
 */
async function archiveGenerated() {
  let archived = 0;
  const activitiesDir = dirPath("activities");
  for (const file of await fs.readdir(activitiesDir)) {
    if (!file.endsWith(".json")) continue;
    const source = path.join(activitiesDir, file);
    const item = await readJson(source);
    if (ARCHIVABLE_STATES.includes(item?.state) || item?.skill_id) {
      await fs.rename(source, path.join(dirPath("archive"), file));
      archived++;
    }
  }
  return { mode: "generated", archived, action: "archived_generated_activities" };
}

/**
 * `activity_capture`: create or merge one Activity per session.
 *
 * When `args.session_id` is absent, the process-scoped `processSessionId` is
 * used, so repeated calls within one MCP process merge into a single record.
 *
 * @param {ToolArgs} args - Capture fields (see `activity_capture` tool schema).
 * @returns {Promise<object>} The Activity with an added `merged` flag.
 * @throws {Error} When `task` or `result` is missing.
 */
async function handleActivityCapture(args) {
  if (!args.task || !args.result) {
    throw Error("task and result are required");
  }

  const sessionId = args.session_id || processSessionId;
  const existing = await findActivityBySession(sessionId);

  const item = existing?.item || {
    id: newId("activity"),
    source: args.source || "codex",
    session_id: sessionId,
    session_id_source: args.session_id ? "provided" : "mcp_process",
    project: args.project || null,
    started_at: now(),
    state: "NEW",
    key_points: [],
    updates: [],
  };

  item.source = args.source || item.source;
  item.project = args.project || item.project;
  item.task = args.task;
  item.context = args.context || item.context || "";
  item.result = args.result;
  item.outcome = args.outcome || item.outcome || "success";
  item.approach = mergeUnique(item.approach, args.approach);
  item.technologies = mergeUnique(item.technologies, args.technologies);
  item.key_points = mergeUnique(item.key_points, args.key_points);
  item.updates.push({
    timestamp: now(),
    summary: args.summary || args.result,
    key_points: args.key_points || [],
  });
  item.updated_at = now();

  const file = existing?.file || `${item.id}.json`;
  await writeJson(path.join(dirPath("activities"), file), item);
  await writeEvent(existing ? "ActivityUpdated" : "ActivityCreated", item);
  return { ...item, merged: Boolean(existing) };
}

/**
 * `candidate_create`: record a reusable pattern as a new Candidate.
 *
 * @param {ToolArgs} args - `title`, `summary`, optional `evidence` and `source`.
 * @returns {Promise<object>} The created Candidate.
 * @throws {Error} When `title` or `summary` is missing.
 */
async function handleCandidateCreate(args) {
  if (!args.title || !args.summary) {
    throw Error("title and summary are required");
  }
  const item = {
    id: newId("candidate"),
    title: args.title,
    summary: args.summary,
    source: args.source || "codex",
    evidence: args.evidence || [],
    created_at: now(),
    state: "OPEN",
  };
  await writeJson(path.join(dirPath("candidates"), `${item.id}.json`), item);
  await writeEvent("CandidateCreated", item);
  return item;
}

/**
 * `candidate_evaluate`: mark a Candidate as pass or fail.
 *
 * @param {ToolArgs} args - `id` and `result` ("pass"|"fail"), optional `reviewer`.
 * @returns {Promise<object>} The updated Candidate.
 * @throws {Error} When the Candidate does not exist.
 */
async function handleCandidateEvaluate(args) {
  const file = path.join(dirPath("candidates"), `${safeName(args.id, "id")}.json`);
  const item = await readJson(file);
  if (!item) throw Error("Candidate not found");

  item.evaluation = {
    result: args.result,
    reviewer: args.reviewer || "codex",
    evaluated_at: now(),
  };
  item.state = args.result === "pass" ? "EVALUATED" : "REJECTED";

  await writeJson(file, item);
  await writeEvent("ReviewSubmitted", item);
  return item;
}

/**
 * `skill_create`: create a Skill draft (skill.json + SKILL.md).
 *
 * @param {ToolArgs} args - `name`, `content`, optional `description`/`candidate_id`.
 * @returns {Promise<object>} The created Skill metadata.
 * @throws {Error} When `name` or `content` is missing, or `name` is invalid.
 */
async function handleSkillCreate(args) {
  if (!args.name || !args.content) {
    throw Error("name and content are required");
  }
  const skillName = safeName(args.name, "name");
  const dir = path.join(dirPath("skills"), skillName);
  await fs.mkdir(dir, { recursive: true });

  const meta = {
    name: skillName,
    description: args.description || "",
    content: args.content,
    source_candidate: args.candidate_id || null,
    state: "DRAFT",
    revision: 0,
    created_at: now(),
    updated_at: now(),
  };
  await writeJson(path.join(dir, "skill.json"), meta);

  const content = args.content.endsWith("\n") ? args.content : `${args.content}\n`;
  await fs.writeFile(path.join(dir, "SKILL.md"), content, "utf8");
  return meta;
}

/**
 * `skill_evaluate`: evaluate a Skill draft as pass or fail.
 *
 * @param {ToolArgs} args - `name`, `result` ("pass"|"fail"), optional
 *   `reviewer` and `notes`.
 * @returns {Promise<object>} The updated Skill metadata.
 * @throws {Error} When the Skill is missing or `result` is invalid.
 */
async function handleSkillEvaluate(args) {
  const skillName = safeName(args.name, "name");
  const file = path.join(dirPath("skills"), skillName, "skill.json");
  const item = await readJson(file);
  if (!item) throw Error("Skill not found");
  if (!["pass", "fail"].includes(args.result)) {
    throw Error("result must be pass or fail");
  }

  item.evaluation = {
    result: args.result,
    reviewer: args.reviewer || "codex",
    evaluated_at: now(),
    notes: args.notes || "",
  };
  item.state = args.result === "pass" ? "EVALUATED" : "REJECTED";
  item.updated_at = now();

  await writeJson(file, item);
  await writeEvent("SkillEvaluationCompleted", item);
  return item;
}

/**
 * `skill_publish`: publish an evaluated Skill, bumping its revision in place.
 *
 * Only the configured Maintainer may publish, and the Skill must have a
 * passing evaluation.
 *
 * @param {ToolArgs} args - `name` and optional `actor` (defaults to "codex").
 * @returns {Promise<object>} The published Skill metadata.
 * @throws {Error} On a non-Maintainer actor, a missing Skill, or a
 *   non-evaluated/failing Skill.
 */
async function handleSkillPublish(args) {
  const config = await loadConfig();
  if (config.maintainer !== (args.actor || "codex")) {
    throw Error("Only the configured Maintainer can publish");
  }

  const skillName = safeName(args.name, "name");
  const file = path.join(dirPath("skills"), skillName, "skill.json");
  const meta = await readJson(file);
  if (!meta) throw Error("Skill not found");
  if (meta.state !== "EVALUATED" || meta.evaluation?.result !== "pass") {
    throw Error("Skill requires a passing evaluation");
  }

  meta.revision = (meta.revision || 0) + 1;
  meta.state = "PUBLISHED";
  meta.published_at = now();
  meta.updated_at = meta.published_at;

  await writeJson(file, meta);
  await writeEvent("SkillPublished", meta);
  return meta;
}

/**
 * Map of tool name → async handler function.
 * @type {Object<string, (args: ToolArgs) => Promise<object>>}
 */
const HANDLERS = {
  hub_init: handleHubInit,
  hub_config: handleHubConfig,
  hub_status: handleHubStatus,
  hub_cleanup: handleHubCleanup,
  activity_capture: handleActivityCapture,
  candidate_create: handleCandidateCreate,
  candidate_evaluate: handleCandidateEvaluate,
  skill_create: handleSkillCreate,
  skill_evaluate: handleSkillEvaluate,
  skill_publish: handleSkillPublish,
};

/**
 * Ensure storage exists, then dispatch a tool call to its handler.
 *
 * @param {string} name - Tool name.
 * @param {ToolArgs} [args={}] - Tool arguments.
 * @returns {Promise<object>} The handler's result.
 * @throws {Error} When `name` does not map to a known tool.
 */
async function call(name, args = {}) {
  const handler = HANDLERS[name];
  if (!handler) throw Error(`Unknown Usora tool: ${name}`);
  await ensure();
  return handler(args);
}

// ---------------------------------------------------------------------------
// Tool schemas
// ---------------------------------------------------------------------------

/**
 * MCP tool definitions exposed via `tools/list`.
 *
 * Each entry follows the MCP `Tool` shape: `{ name, description, inputSchema }`.
 *
 * @type {Array<{name: string, description: string, inputSchema: object}>}
 */
const tools = [
  { name: "hub_init", description: "Initialize the user's local Usora storage. Never create sample data.", inputSchema: { type: "object", properties: {} } },
  { name: "hub_status", description: "Inspect Hub counts and configuration without loading all Activities.", inputSchema: { type: "object", properties: {} } },
  {
    name: "hub_cleanup",
    description: "Clean in two modes: generated archives processed Activities; all permanently deletes every Usora Hub record, Skill, archive, event, and config and requires confirm=true.",
    inputSchema: { type: "object", properties: { mode: { type: "string", enum: ["generated", "all"] }, confirm: { type: "boolean" } } },
  },
  {
    name: "hub_config",
    description: "Configure the Maintainer and automation policy.",
    inputSchema: { type: "object", properties: { maintainer: { type: "string" }, automation_policy: { type: "string", enum: AUTOMATION_POLICIES } } },
  },
  {
    name: "activity_capture",
    description: "Create or update one Activity for the current MCP process. If session_id is supplied, repeated calls with the same value merge; otherwise the server uses its process-scoped session ID.",
    inputSchema: {
      type: "object",
      required: ["task", "result"],
      properties: {
        session_id: { type: "string" },
        task: { type: "string" },
        summary: { type: "string" },
        result: { type: "string" },
        key_points: { type: "array", items: { type: "string" } },
        context: { type: "string" },
        approach: { type: "array", items: { type: "string" } },
        technologies: { type: "array", items: { type: "string" } },
        outcome: { type: "string" },
        source: { type: "string" },
        project: { type: "string" },
      },
    },
  },
  {
    name: "candidate_create",
    description: "Create a Candidate from an observed reusable pattern; do not create one for a one-off task.",
    inputSchema: { type: "object", required: ["title", "summary"], properties: { title: { type: "string" }, summary: { type: "string" }, evidence: { type: "array", items: { type: "string" } }, source: { type: "string" } } },
  },
  {
    name: "candidate_evaluate",
    description: "Evaluate a Candidate as pass or fail and record the reviewer.",
    inputSchema: { type: "object", required: ["id", "result"], properties: { id: { type: "string" }, result: { type: "string", enum: ["pass", "fail"] }, reviewer: { type: "string" } } },
  },
  {
    name: "skill_create",
    description: "Create a Skill draft with SKILL.md content.",
    inputSchema: { type: "object", required: ["name", "content"], properties: { name: { type: "string" }, content: { type: "string" }, description: { type: "string" }, candidate_id: { type: "string" } } },
  },
  {
    name: "skill_evaluate",
    description: "Evaluate a Skill draft as pass or fail.",
    inputSchema: { type: "object", required: ["name", "result"], properties: { name: { type: "string" }, result: { type: "string", enum: ["pass", "fail"] }, reviewer: { type: "string" }, notes: { type: "string" } } },
  },
  {
    name: "skill_publish",
    description: "Publish an evaluated Skill as the configured Maintainer by updating the single current Skill in place.",
    inputSchema: { type: "object", required: ["name"], properties: { name: { type: "string" }, actor: { type: "string" } } },
  },
];

// ---------------------------------------------------------------------------
// JSON-RPC transport
// ---------------------------------------------------------------------------

/**
 * A JSON-RPC request.
 * @typedef {{jsonrpc?: string, id?: (number|string), method: string, params?: object}} RpcRequest
 */

/**
 * Build a JSON-RPC success response.
 * @param {(number|string|undefined)} id - Request id to echo back.
 * @param {*} value - Result payload.
 * @returns {{jsonrpc: string, id: *, result: *}}
 */
function jsonRpcResult(id, value) {
  return { jsonrpc: "2.0", id, result: value };
}

/**
 * Build a successful `tools/call` response (MCP `content` envelope).
 * @param {(number|string|undefined)} id - Request id.
 * @param {*} value - Tool result, serialized as pretty-printed JSON text.
 * @returns {{jsonrpc: string, id: *, result: *}}
 */
function toolCallResult(id, value) {
  return jsonRpcResult(id, { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
}

/**
 * Build a JSON-RPC error response (code `-32000`).
 * @param {(number|string|undefined)} id - Request id.
 * @param {string} message - Error message.
 * @returns {{jsonrpc: string, id: *, error: {code: number, message: string}}}
 */
function jsonRpcError(id, message) {
  return { jsonrpc: "2.0", id, error: { code: -32000, message } };
}

/**
 * Write a single JSON-RPC response line to stdout.
 * @param {object} line - Serializable response object.
 * @returns {void}
 */
function write(line) {
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

/**
 * Handle a non-`tools/call` request (initialize, tools/list, etc.).
 *
 * @param {RpcRequest} req - Parsed request.
 * @returns {object|null} The response object, or `null` for notifications
 *   (requests without an `id`).
 */
function handleRequest(req) {
  switch (req.method) {
    case "initialize":
      return jsonRpcResult(req.id, {
        protocolVersion: req.params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "usora", version: "1.0.0" },
      });
    case "tools/list":
      return jsonRpcResult(req.id, { tools });
    default:
      if (req.id !== undefined) {
        return jsonRpcError(req.id, `Unsupported method: ${req.method}`);
      }
      return null;
  }
}

/** stdio line reader for incoming JSON-RPC messages. */
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

/**
 * Serializes request handling so concurrent lines are processed in order.
 * @type {Promise<void>}
 */
let queue = Promise.resolve();

rl.on("line", line => {
  queue = queue.then(async () => {
    let req;
    try {
      req = JSON.parse(line);
      let response;
      if (req.method === "tools/call") {
        const value = await call(req.params.name, req.params.arguments);
        response = toolCallResult(req.id, value);
      } else {
        response = handleRequest(req);
      }
      if (response) write(response);
    } catch (err) {
      if (req?.id !== undefined) write(jsonRpcError(req.id, err.message));
    }
  });
});
