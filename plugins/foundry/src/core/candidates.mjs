import fs from "node:fs/promises";
import path from "node:path";
import { CANDIDATE_SCHEMA_VERSION, dirPath, newId, now, readJson, writeEvent, writeJson } from "./storage.mjs";
import { listLimit, safeName } from "./validation.mjs";

/**
 * `candidate_create`: record a reusable pattern as a new Candidate.
 *
 * @param {ToolArgs} args - `title`, `summary`, optional `evidence` and `source`.
 * @returns {Promise<object>} The created Candidate.
 * @throws {Error} When `title` or `summary` is missing.
 */
export async function handleCandidateCreate(args) {
  if (!args.title || !args.summary) {
    throw Error("title and summary are required");
  }
  const item = {
    schema_version: CANDIDATE_SCHEMA_VERSION,
    id: newId("candidate"),
    title: args.title,
    summary: args.summary,
    source: args.source || "codex",
    evidence: args.evidence || [],
    created_at: now(),
    state: "OPEN",
  };
  await writeJson(path.join(await dirPath("candidates"), `${item.id}.json`), item);
  await writeEvent("CandidateCreated", item);
  return item;
}

/**
 * `candidate_list`: list recent Candidates.
 *
 * @param {ToolArgs} [args={}] - Optional `limit` (default 20, max 100). Default is `{}`
 * @returns {Promise<object>} Count and recent Candidates.
 */
export async function handleCandidateList(args = {}) {
  const limit = listLimit(args.limit);
  const candidatesDir = await dirPath("candidates");
  const items = [];
  for (const file of await fs.readdir(candidatesDir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const item = await readJson(path.join(candidatesDir, file));
    if (item) items.push(item);
  }
  items.sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""));
  return { count: items.length, candidates: items.slice(0, limit) };
}

/**
 * `candidate_evaluate`: mark a Candidate as pass or fail.
 *
 * @param {ToolArgs} args - `id` and `result` ("pass"|"fail"), optional `reviewer`.
 * @returns {Promise<object>} The updated Candidate.
 * @throws {Error} When the Candidate does not exist.
 */
export async function handleCandidateEvaluate(args) {
  const file = path.join(await dirPath("candidates"), `${safeName(args.id, "id")}.json`);
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
