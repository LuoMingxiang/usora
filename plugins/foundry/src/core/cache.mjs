import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { isInside } from "./validation.mjs";

/**
 * `plugin_cache_cleanup`: list or delete old installed Usora plugin cache versions, keeping the version this MCP server
 * is currently running from.
 *
 * @param {ToolArgs} [args={}] - Pass `confirm: true` to delete old caches. Default is `{}`
 * @returns {Promise<object>} Cleanup preview or deletion result.
 */
export async function handlePluginCacheCleanup(args = {}) {
  const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const cacheRoot = path.dirname(pluginRoot);
  const currentVersion = path.basename(pluginRoot);
  const home = path.resolve(os.homedir()).toLowerCase();
  const normalizedPluginRoot = path.resolve(pluginRoot).toLowerCase();
  const isKnownHostCache =
    normalizedPluginRoot.startsWith(home) &&
    (normalizedPluginRoot.includes(`${path.sep}.codex${path.sep}`) ||
      normalizedPluginRoot.includes(`${path.sep}.codebuddy${path.sep}`)) &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(currentVersion);

  if (!isKnownHostCache) {
    return {
      ok: false,
      action: "not_installed_cache",
      message:
        "Usora is not running from a versioned Codex or CodeBuddy installed plugin cache. Install or upgrade Usora first, then clean old caches.",
      plugin_root: pluginRoot,
    };
  }

  const oldCaches = [];
  for (const entry of await fs.readdir(cacheRoot, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || entry.name === currentVersion) continue;
    const fullPath = path.join(cacheRoot, entry.name);
    if (!isInside(cacheRoot, fullPath)) {
      throw Error(`Refusing to inspect path outside Usora plugin cache: ${fullPath}`);
    }
    oldCaches.push({ version: entry.name, path: fullPath });
  }

  if (args.confirm !== true) {
    return {
      ok: true,
      dry_run: true,
      action: "preview_old_plugin_caches",
      current_version: currentVersion,
      cache_root: cacheRoot,
      old_caches: oldCaches,
      deleted: 0,
    };
  }

  for (const cache of oldCaches) {
    if (!isInside(cacheRoot, cache.path)) {
      throw Error(`Refusing to delete path outside Usora plugin cache: ${cache.path}`);
    }
    await fs.rm(cache.path, { recursive: true, force: true });
  }

  return {
    ok: true,
    dry_run: false,
    action: "deleted_old_plugin_caches",
    current_version: currentVersion,
    cache_root: cacheRoot,
    old_caches: oldCaches,
    deleted: oldCaches.length,
  };
}
