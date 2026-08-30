import path from "node:path";
import { knowledgeDirPath, readJson, writeJson } from "../core/storage.ts";

type SourceState = {
  last_seen_at?: string | null;
  recent_ids?: string[];
};

export type IngestionState = {
  schema_version: number;
  sources: Record<string, SourceState>;
};

export async function ingestionStatePath(): Promise<string> {
  return path.join(await knowledgeDirPath("indexes"), "ingestion.json");
}

export async function loadIngestionState(): Promise<IngestionState> {
  const state = await readJson<IngestionState>(await ingestionStatePath());
  return state && typeof state === "object" && !Array.isArray(state) && state.sources
    ? state
    : { schema_version: 1, sources: {} };
}

export async function saveIngestionState(state: IngestionState): Promise<void> {
  await writeJson(await ingestionStatePath(), state);
}
