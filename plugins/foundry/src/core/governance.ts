import path from "node:path";
import { withKnowledgeLock } from "./lock.ts";
import { knowledgeDirPath, loadConfig, readJson, writeEvent, writeJson } from "./storage.ts";
import { readSkillMetadata, rebuildSkillIndex } from "./skill-index.ts";
import { listLimit, safeName } from "./validation.ts";

const RESOLUTIONS = ["KEEP", "EVOLVE", "MERGE", "DEPRECATE", "RETIRE"];
const DESTRUCTIVE = new Set(["MERGE", "DEPRECATE", "RETIRE"]);
type GovernanceAction = (typeof RESOLUTIONS)[number];

type SkillMeta = Record<string, unknown> & {
  name?: string;
  description?: string;
  tags?: unknown;
  usage_count?: number;
  success_count?: number;
  superseded_by?: string;
  last_used_at?: string;
  updated_at?: string;
  created_at?: string;
  state?: string;
};
type GovernanceScanArgs = {
  limit?: unknown;
  stale_days?: unknown;
  min_success_rate?: unknown;
  duplicate_threshold?: unknown;
};
type GovernanceResolveArgs = {
  request_id?: string;
  action?: string;
  actor?: string;
  skill?: unknown;
  reason?: string;
  target_skill?: unknown;
  related_to?: string;
  depends_on?: string;
  conflicts_with?: string;
};

function isRecord(value: unknown): value is SkillMeta {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function skillName(skill: SkillMeta): string {
  return typeof skill.name === "string" ? skill.name : "";
}

async function skillsForGovernance(): Promise<SkillMeta[]> {
  return (await readSkillMetadata()).filter(isRecord);
}

function words(value: unknown): Set<string> {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  );
}

function overlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / new Set([...left, ...right]).size;
}

function skillText(skill: SkillMeta): string {
  return [skill.name, skill.description, ...arrayOfStrings(skill.tags)].join(" ");
}

function successRate(skill: SkillMeta): number | null {
  return skill.usage_count ? (skill.success_count || 0) / skill.usage_count : null;
}

async function skillRecord(name: unknown): Promise<{ file: string; meta: SkillMeta }> {
  const skillName = safeName(name, "name");
  const file = path.join(await knowledgeDirPath("skills"), skillName, "skill.json");
  const meta = await readJson(file);
  if (!isRecord(meta)) throw Error("Skill not found");
  return { file, meta };
}

function finding(type: string, skill: SkillMeta, reason: string, extra: Record<string, unknown> = {}) {
  return { type, skill: skill.name, reason, ...extra };
}

export async function handleGovernanceScan(args: GovernanceScanArgs = {}) {
  const limit = listLimit(args.limit);
  const nowMs = Date.now();
  const staleDays = args.stale_days === undefined ? 90 : Number(args.stale_days);
  const skills = await skillsForGovernance();
  const findings = [];

  for (const skill of skills) {
    if (!skill.usage_count) findings.push(finding("unused", skill, "Skill has no recorded usage."));
    const rate = successRate(skill);
    if (rate !== null && (skill.usage_count || 0) >= 2 && rate < (Number(args.min_success_rate) || 0.5)) {
      findings.push(finding("low-success", skill, "Skill success rate is below threshold.", { success_rate: rate }));
    }
    if (skill.superseded_by)
      findings.push(finding("superseded", skill, `Skill is superseded by ${skill.superseded_by}.`));
    const timestamp = Date.parse(skill.last_used_at || skill.updated_at || skill.created_at || "");
    if (timestamp && nowMs - timestamp > staleDays * 24 * 60 * 60 * 1000) {
      findings.push(finding("stale", skill, "Skill has not been updated or used recently."));
    }
  }

  for (let left = 0; left < skills.length; left += 1) {
    for (let right = left + 1; right < skills.length; right += 1) {
      const leftSkill = skills[left];
      const rightSkill = skills[right];
      if (!leftSkill || !rightSkill) continue;
      const score = overlap(words(skillText(leftSkill)), words(skillText(rightSkill)));
      if (score >= (Number(args.duplicate_threshold) || 0.6)) {
        findings.push(
          finding("duplicate", leftSkill, "Skill metadata overlaps another Skill.", {
            duplicate_of: rightSkill.name,
            score,
          }),
        );
      }
    }
  }

  return { count: findings.length, findings: findings.slice(0, limit) };
}

function addGraph(meta: SkillMeta, field: string, value: string | undefined): void {
  if (!value) return;
  meta[field] = [...new Set([...arrayOfStrings(meta[field]), value])];
}

function requireAction(value: unknown): GovernanceAction {
  if (typeof value !== "string" || !RESOLUTIONS.includes(value)) {
    throw Error("action must be KEEP, EVOLVE, MERGE, DEPRECATE, or RETIRE");
  }
  return value;
}

export async function handleGovernanceResolve(args: GovernanceResolveArgs = {}) {
  return withKnowledgeLock("skills", () => resolveGovernance(args));
}

async function resolveGovernance(args: GovernanceResolveArgs = {}) {
  const action = requireAction(args.action);
  const config = await loadConfig();
  if (DESTRUCTIVE.has(action) && config.maintainer !== (args.actor || "codex")) {
    throw Error("Only the configured Maintainer can apply destructive governance actions");
  }

  const { file, meta } = await skillRecord(args.skill);
  const requests =
    meta.integration_requests && typeof meta.integration_requests === "object"
      ? (meta.integration_requests as Record<string, unknown>)
      : {};
  if (typeof args.request_id === "string" && Object.hasOwn(requests, args.request_id)) {
    await rebuildSkillIndex();
    await writeEvent("GovernanceResolved", requests[args.request_id], `${meta.name}:${args.request_id}`);
    return requests[args.request_id];
  }
  meta.governance_status = action;
  meta.governance_reason = args.reason || "";

  if (action === "MERGE") {
    const target = safeName(args.target_skill, "target_skill");
    const targetRecord = await skillRecord(target);
    meta.state = "MERGED";
    meta.superseded_by = target;
    addGraph(meta, "related_to", target);
    addGraph(targetRecord.meta, "supersedes", skillName(meta));
    await writeJson(targetRecord.file, targetRecord.meta);
  }
  if (action === "DEPRECATE") meta.state = "DEPRECATED";
  if (action === "RETIRE") meta.state = "RETIRED";
  if (args.related_to) addGraph(meta, "related_to", args.related_to);
  if (args.depends_on) addGraph(meta, "depends_on", args.depends_on);
  if (args.conflicts_with) addGraph(meta, "conflicts_with", args.conflicts_with);

  const result = { action, skill: meta.name, target_skill: args.target_skill || null, state: meta.state };
  if (typeof args.request_id === "string") meta.integration_requests = { ...requests, [args.request_id]: result };
  await writeJson(file, meta);
  await rebuildSkillIndex();
  await writeEvent("GovernanceResolved", result, args.request_id ? `${meta.name}:${args.request_id}` : undefined);
  return result;
}

export async function handleSkillGraphValidate() {
  const skills = await skillsForGovernance();
  const names = new Set(skills.map((skill) => skill.name));
  const issues = [];
  for (const skill of skills) {
    for (const field of ["related_to", "depends_on", "supersedes", "conflicts_with"]) {
      for (const target of arrayOfStrings(skill[field])) {
        if (!names.has(target)) issues.push({ skill: skill.name, field, target, issue: "missing_skill" });
      }
    }
  }
  return { ok: issues.length === 0, issues };
}
