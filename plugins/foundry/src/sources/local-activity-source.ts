import fs from "node:fs/promises";
import path from "node:path";
import { hostDirPath, readJson } from "../core/storage.ts";
import type { ActivitySource, ActivitySourceRecord } from "./activity-source.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function exists(dir: string): Promise<boolean> {
  try {
    await fs.access(dir);
    return true;
  } catch {
    return false;
  }
}

export class LocalActivitySource implements ActivitySource {
  constructor(
    public id: string,
    public host: string,
    private readonly rootResolver: () => Promise<string | null>,
  ) {}

  async root(): Promise<string | null> {
    return this.rootResolver();
  }

  async activitiesPath(): Promise<string | null> {
    const root = await this.root();
    return root ? path.join(root, "activities") : null;
  }

  async discover(): Promise<boolean> {
    const dir = await this.activitiesPath();
    return Boolean(dir && (await exists(dir)));
  }

  async readActivities(): Promise<ActivitySourceRecord[]> {
    const dir = await this.activitiesPath();
    if (!dir) return [];
    const records: ActivitySourceRecord[] = [];
    for (const file of await fs.readdir(dir).catch(() => [])) {
      if (!file.endsWith(".json")) continue;
      const activity = await readJson(path.join(dir, file));
      if (!isRecord(activity) || !activity.fingerprint || !isRecord(activity.digest)) continue;
      if (activity.state === "ARCHIVED") continue;
      records.push({ source: { id: this.id, host: this.host }, activity });
    }
    return records;
  }
}

export async function currentHostRoot(): Promise<string> {
  return path.dirname(await hostDirPath("activities"));
}
