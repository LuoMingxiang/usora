import path from "node:path";
import { dirPath, loadConfig, readJson, writeEvent, writeJson } from "./storage.mjs";
import { readSkillMetadata, rebuildSkillIndex } from "./skill-index.mjs";
import { listLimit, safeName } from "./validation.mjs";

const RESOLUTIONS = ["KEEP", "EVOLVE", "MERGE", "DEPRECATE", "RETIRE"];
const DESTRUCTIVE = new Set(["MERGE", "DEPRECATE", "RETIRE"]);

function words(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  );
}

function overlap(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / new Set([...left, ...right]).size;
}

function skillText(skill) {
  return [skill.name, skill.description, ...(skill.tags || [])].join(" ");
}

function successRate(skill) {
  return skill.usage_count ? (skill.success_count || 0) / skill.usage_count : null;
}

async function skillRecord(name) {
  const skillName = safeName(name, "name");
  const file = path.join(await dirPath("skills"), skillName, "skill.json");
  const meta = await readJson(file);
  if (!meta) throw Error("Skill not found");
  return { file, meta };
}

function finding(type, skill, reason, extra = {}) {
  return { type, skill: skill.name, reason, ...extra };
}

export async function handleGovernanceScan(args = {}) {
  const limit = listLimit(args.limit);
  const nowMs = Date.now();
  const staleDays = args.stale_days === undefined ? 90 : Number(args.stale_days);
  const skills = await readSkillMetadata();
  const findings = [];

  for (const skill of skills) {
    if (!skill.usage_count) findings.push(finding("unused", skill, "Skill has no recorded usage."));
    const rate = successRate(skill);
    if (rate !== null && skill.usage_count >= 2 && rate < (Number(args.min_success_rate) || 0.5)) {
      findings.push(finding("low-success", skill, "Skill success rate is below threshold.", { success_rate: rate }));
    }
    if (skill.superseded_by)
      findings.push(finding("superseded", skill, `Skill is superseded by ${skill.superseded_by}.`));
    const timestamp = Date.parse(skill.last_used_at || skill.updated_at || skill.created_at || 0);
    if (timestamp && nowMs - timestamp > staleDays * 24 * 60 * 60 * 1000) {
      findings.push(finding("stale", skill, "Skill has not been updated or used recently."));
    }
  }

  for (let left = 0; left < skills.length; left += 1) {
    for (let right = left + 1; right < skills.length; right += 1) {
      const score = overlap(words(skillText(skills[left])), words(skillText(skills[right])));
      if (score >= (Number(args.duplicate_threshold) || 0.6)) {
        findings.push(
          finding("duplicate", skills[left], "Skill metadata overlaps another Skill.", {
            duplicate_of: skills[right].name,
            score,
          }),
        );
      }
    }
  }

  return { count: findings.length, findings: findings.slice(0, limit) };
}

function addGraph(meta, field, value) {
  if (!value) return;
  meta[field] = [...new Set([...(meta[field] || []), value])];
}

export async function handleGovernanceResolve(args = {}) {
  const action = args.action;
  if (!RESOLUTIONS.includes(action)) throw Error("action must be KEEP, EVOLVE, MERGE, DEPRECATE, or RETIRE");
  const config = await loadConfig();
  if (DESTRUCTIVE.has(action) && config.maintainer !== (args.actor || "codex")) {
    throw Error("Only the configured Maintainer can apply destructive governance actions");
  }

  const { file, meta } = await skillRecord(args.skill);
  meta.governance_status = action;
  meta.governance_reason = args.reason || "";

  if (action === "MERGE") {
    const target = safeName(args.target_skill, "target_skill");
    const targetRecord = await skillRecord(target);
    meta.state = "MERGED";
    meta.superseded_by = target;
    addGraph(meta, "related_to", target);
    addGraph(targetRecord.meta, "supersedes", meta.name);
    await writeJson(targetRecord.file, targetRecord.meta);
  }
  if (action === "DEPRECATE") meta.state = "DEPRECATED";
  if (action === "RETIRE") meta.state = "RETIRED";
  if (args.related_to) addGraph(meta, "related_to", args.related_to);
  if (args.depends_on) addGraph(meta, "depends_on", args.depends_on);
  if (args.conflicts_with) addGraph(meta, "conflicts_with", args.conflicts_with);

  await writeJson(file, meta);
  await rebuildSkillIndex();
  const result = { action, skill: meta.name, target_skill: args.target_skill || null, state: meta.state };
  await writeEvent("GovernanceResolved", result);
  return result;
}

export async function handleSkillGraphValidate() {
  const skills = await readSkillMetadata();
  const names = new Set(skills.map((skill) => skill.name));
  const issues = [];
  for (const skill of skills) {
    for (const field of ["related_to", "depends_on", "supersedes", "conflicts_with"]) {
      for (const target of skill[field] || []) {
        if (!names.has(target)) issues.push({ skill: skill.name, field, target, issue: "missing_skill" });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
