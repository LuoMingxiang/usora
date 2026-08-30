import path from "node:path";
import { withKnowledgeLock } from "./lock.ts";
import { knowledgeDirPath, newId, now, readJson, writeEvent, writeJson } from "./storage.ts";
import { rebuildSkillIndex } from "./skill-index.ts";
import { safeName } from "./validation.ts";

const OUTCOMES = ["success", "partial", "failure", "unknown"];
type UsageOutcome = (typeof OUTCOMES)[number];
type UsageCaptureArgs = {
  skill?: unknown;
  outcome?: UsageOutcome;
  used_at?: string;
  session_id?: unknown;
  activity_id?: unknown;
  validation_evidence?: unknown;
  project?: unknown;
};
type SkillMetadata = Record<string, unknown> & {
  usage_count?: number;
  success_count?: number;
  partial_count?: number;
  failure_count?: number;
  last_used_at?: string;
  projects_used?: string[];
};

function isRecord(value: unknown): value is SkillMetadata {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bump(meta: SkillMetadata, outcome: UsageOutcome): void {
  meta.usage_count = (meta.usage_count || 0) + 1;
  meta.success_count = (meta.success_count || 0) + (outcome === "success" ? 1 : 0);
  meta.partial_count = (meta.partial_count || 0) + (outcome === "partial" ? 1 : 0);
  meta.failure_count = (meta.failure_count || 0) + (outcome === "failure" ? 1 : 0);
}

export async function handleUsageCapture(args: UsageCaptureArgs = {}) {
  return withKnowledgeLock("skills", () => captureUsage(args));
}

async function captureUsage(args: UsageCaptureArgs = {}) {
  const skill = safeName(args.skill, "skill");
  const outcome = args.outcome || "unknown";
  if (!OUTCOMES.includes(outcome)) throw Error("outcome must be success, partial, failure, or unknown");

  const skillFile = path.join(await knowledgeDirPath("skills"), skill, "skill.json");
  const meta = await readJson(skillFile);
  if (!isRecord(meta)) throw Error("Skill not found");

  const usedAt = args.used_at || now();
  const usage = {
    schema_version: 1,
    id: newId("usage"),
    session_id: args.session_id || null,
    skill,
    activity_id: args.activity_id || null,
    outcome,
    validation_evidence: args.validation_evidence || [],
    project: args.project || null,
    used_at: usedAt,
  };
  await writeJson(path.join(await knowledgeDirPath("usage"), `${usage.id}.json`), usage);

  bump(meta, outcome);
  meta.last_used_at = usedAt;
  meta.projects_used = [
    ...new Set(
      [...(meta.projects_used || []), args.project].filter((project): project is string => typeof project === "string"),
    ),
  ];
  await writeJson(skillFile, meta);
  await rebuildSkillIndex();
  await writeEvent("UsageCaptured", usage);
  return { usage, skill: meta };
}
