import fs from "node:fs/promises";
import path from "node:path";
import { checkContextBudget, recordIntelligenceRun } from "./context-budget.mjs";
import {
  SKILL_METADATA_SCHEMA_VERSION,
  dirPath,
  loadConfig,
  now,
  readJson,
  writeEvent,
  writeJson,
} from "./storage.mjs";
import { querySkillIndex, rebuildSkillIndex, skillSummary } from "./skill-index.mjs";
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
  return candidate;
}

async function readSkillMeta(name) {
  const skillName = safeName(name, "name");
  const file = path.join(await dirPath("skills"), skillName, "skill.json");
  const meta = await readJson(file);
  if (!meta) throw Error("Skill not found");
  return { skillName, file, meta, dir: path.dirname(file) };
}

function generatedSkillName(candidate, fallback = "generated-skill") {
  const slug = String(candidate.title || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || fallback;
}

function generatedSkillContent(candidate, similarSkills) {
  const evidence = (candidate.evidence || [])
    .slice(0, 3)
    .map((item) => `- ${item.activity_id || item.id || "evidence"}${item.reason ? `: ${item.reason}` : ""}`)
    .join("\n");
  const similar = similarSkills
    .slice(0, 3)
    .map((skill) => `- ${skill.name}: ${skill.description || skill.state || "metadata only"}`)
    .join("\n");
  return [
    `# ${candidate.title}`,
    "",
    "## When To Use",
    candidate.summary,
    "",
    "## Evidence",
    evidence || "- No evidence refs provided.",
    "",
    "## Similar Skills Checked",
    similar || "- No similar Skill metadata found.",
    "",
  ].join("\n");
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
    generation: args.generation || null,
    state: "DRAFT",
    revision: 0,
    created_at: now(),
    updated_at: now(),
  };
  await writeJson(path.join(dir, "skill.json"), meta);

  const content = args.content.endsWith("\n") ? args.content : `${args.content}\n`;
  await fs.writeFile(path.join(dir, "SKILL.md"), content, "utf8");
  await rebuildSkillIndex();
  await writeEvent("SkillDraftCreated", meta);
  return meta;
}

export async function handleSkillGenerate(args = {}) {
  const started = Date.now();
  const candidate = await requirePassingCandidate(args.candidate_id);
  const similar = await querySkillIndex({
    q: [candidate.title, candidate.summary, ...(candidate.technologies || [])].join(" "),
    limit: 3,
  });
  const content = generatedSkillContent(candidate, similar.skills);
  const generation = {
    source: "candidate_spec",
    evidence_loaded: Math.min((candidate.evidence || []).length, 3),
    skills_loaded: similar.skills.length,
    full_activity_load: false,
    full_skill_load: false,
  };
  const budget = await checkContextBudget("skill_compiler", {
    required: { candidate: { ...candidate, evidence: (candidate.evidence || []).slice(0, 3) } },
    recommended: { similar_skills: similar.skills.slice(0, 3) },
    optional: {},
  });
  const skill = await handleSkillCreate({
    name: args.name || generatedSkillName(candidate),
    description: args.description || candidate.summary,
    content,
    candidate_id: candidate.id,
    generation,
  });
  await recordIntelligenceRun({
    stage: "skill_compiler",
    input: {
      candidate: { ...candidate, evidence: (candidate.evidence || []).slice(0, 3) },
      similar_skills: similar.skills,
    },
    output: skill,
    evidence_loaded: generation.evidence_loaded,
    skills_loaded: generation.skills_loaded,
    full_activity_load: false,
    full_skill_load: false,
    cache_hit: false,
    duration_ms: Date.now() - started,
    budget,
  });
  return skill;
}

function skillDelta(args, candidate, action) {
  return {
    schema_version: 1,
    action,
    reason: args.reason || "",
    evidence: args.evidence || candidate?.evidence?.slice(0, 3) || [],
    source_candidate: candidate?.id || args.candidate_id || null,
    source_pattern: args.pattern_fingerprint || candidate?.fingerprint || null,
    changes: args.changes || {},
    target_skill: args.target_skill || null,
    created_at: now(),
  };
}

async function patchSkill(name, delta) {
  const { file, meta, dir } = await readSkillMeta(name);
  const current = await fs.readFile(path.join(dir, "SKILL.md"), "utf8").catch(() => meta.content || "");
  const append = delta.changes.content_append || "";
  const nextContent = delta.changes.content || (append ? `${current.trimEnd()}\n\n${append.trim()}\n` : current);
  meta.content = nextContent;
  meta.description = delta.changes.description || meta.description;
  meta.source_candidate = delta.source_candidate || meta.source_candidate || null;
  meta.source_patterns = [...new Set([...(meta.source_patterns || []), delta.source_pattern].filter(Boolean))];
  meta.revision = (meta.revision || 0) + 1;
  meta.updated_at = now();
  meta.evolution = [...(meta.evolution || []), delta].slice(-20);
  await writeJson(file, meta);
  await fs.writeFile(path.join(dir, "SKILL.md"), nextContent.endsWith("\n") ? nextContent : `${nextContent}\n`, "utf8");
  await rebuildSkillIndex();
  await writeEvent("SkillEvolved", { name: meta.name, revision: meta.revision, delta });
  return meta;
}

export async function handleSkillEvolve(args = {}) {
  if (args.action && !["CREATE", "PATCH", "NOOP", "SPLIT", "MERGE"].includes(args.action)) {
    throw Error("action must be CREATE, PATCH, NOOP, SPLIT, or MERGE");
  }
  const candidate = args.candidate_id ? await requirePassingCandidate(args.candidate_id) : null;
  const action = args.action || null;
  if ((action === "CREATE" || (!action && !args.name)) && !candidate) {
    throw Error("candidate_id is required to create a Skill evolution");
  }
  if (action === "CREATE") return handleSkillGenerate(args);

  const similar = candidate
    ? await querySkillIndex({
        q: [candidate.title, candidate.summary, ...(candidate.technologies || [])].join(" "),
        limit: 3,
      })
    : { skills: [] };
  const target = args.name || similar.skills[0]?.name;
  const resolvedAction =
    action || (target && (similar.skills[0]?.score || 0) >= (Number(args.threshold) || 0.2) ? "PATCH" : "CREATE");

  if (resolvedAction === "CREATE")
    return handleSkillGenerate({ ...args, candidate_id: candidate?.id || args.candidate_id });

  const delta = skillDelta(args, candidate, resolvedAction);
  if (resolvedAction === "PATCH") {
    if (!target) throw Error("name is required for PATCH");
    const patch = delta.changes.content_append
      ? delta
      : {
          ...delta,
          changes: {
            ...delta.changes,
            content_append: `## Evolution\n${candidate?.summary || args.reason || "Updated behavior."}`,
          },
        };
    return patchSkill(target, patch);
  }

  const result = { action: resolvedAction, target_skill: target || null, delta, similar_skills: similar.skills };
  await writeEvent("SkillEvolutionRecommended", result);
  return result;
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
  await rebuildSkillIndex();
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
  await rebuildSkillIndex();
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
    items.push(skillSummary(meta));
  }
  items.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return { count: items.length, skills: items.slice(0, limit) };
}

export async function handleSkillQuery(args = {}) {
  return querySkillIndex(args);
}

export async function handleSkillGet(args = {}) {
  return handleSkillRead(args);
}
