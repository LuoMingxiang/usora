import path from "node:path";
import { dirPath, newId, now, readJson, writeEvent, writeJson } from "./storage.mjs";
import { rebuildSkillIndex } from "./skill-index.mjs";
import { safeName } from "./validation.mjs";

const OUTCOMES = ["success", "partial", "failure", "unknown"];

function bump(meta, outcome) {
  meta.usage_count = (meta.usage_count || 0) + 1;
  meta.success_count = (meta.success_count || 0) + (outcome === "success" ? 1 : 0);
  meta.partial_count = (meta.partial_count || 0) + (outcome === "partial" ? 1 : 0);
  meta.failure_count = (meta.failure_count || 0) + (outcome === "failure" ? 1 : 0);
}

export async function handleUsageCapture(args = {}) {
  const skill = safeName(args.skill, "skill");
  const outcome = args.outcome || "unknown";
  if (!OUTCOMES.includes(outcome)) throw Error("outcome must be success, partial, failure, or unknown");

  const skillFile = path.join(await dirPath("skills"), skill, "skill.json");
  const meta = await readJson(skillFile);
  if (!meta) throw Error("Skill not found");

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
  await writeJson(path.join(await dirPath("usage"), `${usage.id}.json`), usage);

  bump(meta, outcome);
  meta.last_used_at = usedAt;
  meta.projects_used = [...new Set([...(meta.projects_used || []), args.project].filter(Boolean))];
  await writeJson(skillFile, meta);
  await rebuildSkillIndex();
  await writeEvent("UsageCaptured", usage);
  return { usage, skill: meta };
}
