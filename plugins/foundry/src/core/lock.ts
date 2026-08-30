import fs from "node:fs/promises";
import path from "node:path";
import { knowledgeDirPath } from "./storage.ts";

const STALE_LOCK_MS = 30_000;
const heldLocks = new Set<string>();

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withKnowledgeLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (heldLocks.has(name)) return fn();
  const locksDir = path.join(await knowledgeDirPath("indexes"), "locks");
  await fs.mkdir(locksDir, { recursive: true });
  const file = path.join(locksDir, `${name}.lock`);

  for (let attempt = 0; attempt < 100; attempt++) {
    let handle: fs.FileHandle | null = null;
    try {
      handle = await fs.open(file, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
      await handle.close();
      heldLocks.add(name);
      try {
        return await fn();
      } finally {
        heldLocks.delete(name);
        await fs.rm(file, { force: true });
      }
    } catch (err) {
      await handle?.close().catch(() => {});
      const code = err && typeof err === "object" && "code" in err ? err.code : null;
      if (code !== "EEXIST") throw err;
      const stat = await fs.stat(file).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
        await fs.rm(file, { force: true }).catch(() => {});
      }
      await sleep(25);
    }
  }
  throw Error(`Timed out waiting for ${name} knowledge lock`);
}
