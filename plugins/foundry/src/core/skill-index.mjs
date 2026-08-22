import fs from "node:fs/promises";
import path from "node:path";
import { dirPath, now, readJson, writeJson } from "./storage.mjs";
import { listLimit } from "./validation.mjs";

const SKILL_INDEX_FILE = "skills.json";

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

function pickFields(item, fields) {
  if (!Array.isArray(fields) || fields.length === 0) return item;
  return Object.fromEntries(fields.filter((field) => field in item).map((field) => [field, item[field]]));
}

export function skillSummary(meta) {
  const { content: _content, ...summary } = meta;
  return summary;
}

async function skillIndexPath() {
  return path.join(await dirPath("indexes"), SKILL_INDEX_FILE);
}

export async function readSkillMetadata() {
  const skillsDir = await dirPath("skills");
  const items = [];
  for (const dir of await fs.readdir(skillsDir).catch(() => [])) {
    const meta = await readJson(path.join(skillsDir, dir, "skill.json"));
    if (meta) items.push(skillSummary(meta));
  }
  return items;
}

export async function rebuildSkillIndex() {
  const skills = await readSkillMetadata();
  skills.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  const index = { schema_version: 1, generated_at: now(), skills };
  await writeJson(await skillIndexPath(), index);
  return { count: skills.length, skills };
}

export async function querySkillIndex(args = {}) {
  const limit = listLimit(args.limit);
  let index = await readJson(await skillIndexPath());
  if (!index) index = await rebuildSkillIndex();
  let skills = index.skills || [];
  if (args.state) skills = skills.filter((skill) => skill.state === args.state);
  if (args.candidate_id) skills = skills.filter((skill) => skill.source_candidate === args.candidate_id);
  if (args.since) skills = skills.filter((skill) => (skill.updated_at || skill.created_at || "") >= args.since);
  if (args.q) {
    const query = words(args.q);
    skills = skills
      .map((skill) => ({
        ...skill,
        score: overlap(query, words([skill.name, skill.description, skill.state].join(" "))),
      }))
      .filter((skill) => skill.score > 0)
      .sort((a, b) => b.score - a.score);
  }
  return { count: skills.length, skills: skills.slice(0, limit).map((skill) => pickFields(skill, args.fields)) };
}

export async function handleSkillIndex(args = {}) {
  return args.mode === "rebuild" ? rebuildSkillIndex() : querySkillIndex(args);
}
