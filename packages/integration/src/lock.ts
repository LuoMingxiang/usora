import fs from "node:fs/promises";
import path from "node:path";

export async function withIntegrationLock<T>(root: string, work: () => Promise<T>): Promise<T> {
  const { default: lockfile } = await import("proper-lockfile");
  await fs.mkdir(root, { recursive: true });
  const release = await lockfile.lock(root, {
    lockfilePath: path.join(root, "runtime.lock"),
    stale: 30_000,
    update: 10_000,
  });
  try {
    return await work();
  } finally {
    await release();
  }
}
