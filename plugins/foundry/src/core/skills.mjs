import fs from "node:fs/promises";
import path from "node:path";
import {
  SKILL_METADATA_SCHEMA_VERSION,
  dirPath,
  loadConfig,
  now,
  readJson,
  writeEvent,
  writeJson,
} from "./storage.mjs";
import { listLimit, safeName } from "./validation.mjs";

async function readCandidate(id) {
  return readJson(path.join(await dirPath("candidates"), `${safeName(id, "candidate_id")}.json`));
}

async function requirePassingCandidate(candidateId) {
  if (!candidateId) return;
  const candidate = await readCandidate(candidateId);
  if (!candidate) throw Error("Candidate not found");
  if (candidate.state !== "EVALUATED" || candidate.evaluation?.result !== "pass") {
    throw Error("Skill requires a passing Candidate evaluation");
  }
}

/**
 * `skill_create`: create a Skill draft (skill.json + SKILL.md).
 *
 * @param {ToolArgs} args - `name`, `content`, optional `description`/`candidate_id`.
 * @returns {Promise<object>} The created Skill metadata.
 * @throws {Error} When `name` or `content` is missing, or `name` is invalid.
 */
export async function handleSkillCreate(args) {
  if (!args.name || !args.content) {
    throw Error("name and content are required");
  }
  await requirePassingCandidate(args.candidate_id);
  const skillName = safeName(args.name, "name");
  const dir = path.join(await dirPath("skills"), skillName);
  await fs.mkdir(dir, { recursive: true });

  const meta = {
    schema_version: SKILL_METADATA_SCHEMA_VERSION,
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
  await writeEvent("SkillDraftCreated", meta);
  return meta;
}

/**
 * `skill_evaluate`: evaluate a Skill draft as pass or fail.
 *
 * @param {ToolArgs} args - `name`, `result` ("pass"|"fail"), optional `reviewer` and `notes`.
 * @returns {Promise<object>} The updated Skill metadata.
 * @throws {Error} When the Skill is missing or `result` is invalid.
 */
export async function handleSkillEvaluate(args) {
  const skillName = safeName(args.name, "name");
  const file = path.join(await dirPath("skills"), skillName, "skill.json");
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
 * Only the configured Maintainer may publish, and the Skill must have a passing evaluation.
 *
 * @param {ToolArgs} args - `name` and optional `actor` (defaults to "codex").
 * @returns {Promise<object>} The published Skill metadata.
 * @throws {Error} On a non-Maintainer actor, a missing Skill, or a non-evaluated/failing Skill.
 */
export async function handleSkillPublish(args) {
  const config = await loadConfig();
  if (config.maintainer !== (args.actor || "codex")) {
    throw Error("Only the configured Maintainer can publish");
  }

  const skillName = safeName(args.name, "name");
  const file = path.join(await dirPath("skills"), skillName, "skill.json");
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
 * `skill_read`: read one Skill's metadata and SKILL.md content.
 *
 * @param {ToolArgs} args - `name` of the Skill to read.
 * @returns {Promise<object>} Skill metadata plus current SKILL.md content.
 * @throws {Error} When the Skill is missing.
 */
export async function handleSkillRead(args) {
  const skillName = safeName(args.name, "name");
  const dir = path.join(await dirPath("skills"), skillName);
  const meta = await readJson(path.join(dir, "skill.json"));
  if (!meta) throw Error("Skill not found");
  const content = await fs.readFile(path.join(dir, "SKILL.md"), "utf8").catch(() => meta.content || "");
  const { content: _storedContent, ...metadata } = meta;
  return { metadata, content };
}

/**
 * `skill_list`: list Skill metadata without loading SKILL.md content.
 *
 * @param {ToolArgs} [args={}] - Optional `limit` (default 20, max 100). Default is `{}`
 * @returns {Promise<object>} Count and recent Skill metadata.
 */
export async function handleSkillList(args = {}) {
  const limit = listLimit(args.limit);
  const skillsDir = await dirPath("skills");
  const items = [];
  for (const dir of await fs.readdir(skillsDir).catch(() => [])) {
    const meta = await readJson(path.join(skillsDir, dir, "skill.json"));
    if (!meta) continue;
    const { content: _content, ...summary } = meta;
    items.push(summary);
  }
  items.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return { count: items.length, skills: items.slice(0, limit) };
}
