import fs from "node:fs/promises";
import path from "node:path";
import { dirPath, now, readJson, writeJson } from "./storage.ts";
import { listLimit } from "./validation.ts";

const SKILL_INDEX_FILE = "skills.json";

type SkillMetadata = Record<string, unknown> & {
  name?: string;
  description?: string;
  state?: string;
  source_candidate?: string;
  created_at?: string;
  updated_at?: string;
  content?: unknown;
  score?: number;
};

type SkillIndex = {
  schema_version: number;
  generated_at: string;
  skills: SkillMetadata[];
};

type SkillIndexArgs = {
  mode?: string;
  limit?: unknown;
  state?: string;
  candidate_id?: string;
  since?: string;
  q?: string;
  fields?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function pickFields(item: SkillMetadata, fields: unknown): SkillMetadata {
  if (!Array.isArray(fields) || fields.length === 0) return item;
  return Object.fromEntries(
    fields
      .filter((field): field is string => typeof field === "string" && field in item)
      .map((field) => [field, item[field]]),
  );
}

export function skillSummary(meta: SkillMetadata): SkillMetadata {
  const { content: _content, ...summary } = meta;
  return summary;
}

async function skillIndexPath(): Promise<string> {
  return path.join(await dirPath("indexes"), SKILL_INDEX_FILE);
}

export async function readSkillMetadata(): Promise<SkillMetadata[]> {
  const skillsDir = await dirPath("skills");
  const items: SkillMetadata[] = [];
  for (const dir of await fs.readdir(skillsDir).catch(() => [])) {
    const meta = await readJson(path.join(skillsDir, dir, "skill.json"));
    if (isRecord(meta)) items.push(skillSummary(meta));
  }
  return items;
}

export async function rebuildSkillIndex(): Promise<{ count: number; skills: SkillMetadata[] }> {
  const skills = await readSkillMetadata();
  skills.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  const index: SkillIndex = { schema_version: 1, generated_at: now(), skills };
  await writeJson(await skillIndexPath(), index);
  return { count: skills.length, skills };
}

export async function querySkillIndex(args: SkillIndexArgs = {}) {
  const limit = listLimit(args.limit);
  const indexFile = await skillIndexPath();
  const storedIndex = await readJson<SkillIndex>(indexFile);
  const index =
    storedIndex && Array.isArray(storedIndex.skills)
      ? storedIndex
      : ({ skills: (await rebuildSkillIndex()).skills } as SkillIndex);
  let skills = index.skills;
  if (args.state) skills = skills.filter((skill) => skill.state === args.state);
  if (args.candidate_id) skills = skills.filter((skill) => skill.source_candidate === args.candidate_id);
  if (args.since) {
    const since = args.since;
    skills = skills.filter((skill) => (skill.updated_at || skill.created_at || "") >= since);
  }
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

export async function handleSkillIndex(args: SkillIndexArgs = {}) {
  return args.mode === "rebuild" ? rebuildSkillIndex() : querySkillIndex(args);
}
