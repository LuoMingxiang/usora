import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deterministicZip, validateArchivePaths } from "../../../../../packages/shared/src/zip.ts";
import { anchorHome, knowledgeHome } from "../storage.ts";
import type { SkillSnapshot, ValidationResult } from "./types.ts";

type ExportFormat = "directory" | "zip";
type ExportResult = ValidationResult & {
  exported: boolean;
  dry_run: boolean;
  target: string | null;
  format: ExportFormat;
  conflict: boolean;
  sha256?: string;
};

function codeOf(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
}

function contains(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function lstatOrNull(file: string) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (codeOf(error) === "ENOENT") return null;
    throw error;
  }
}

async function assertRealDirectoryAncestors(directory: string): Promise<void> {
  const root = path.parse(directory).root;
  let current = root;
  for (const component of directory.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const stat = await lstatOrNull(current);
    if (!stat?.isDirectory() || stat.isSymbolicLink()) {
      throw Error("PORTABILITY_OUTPUT_PATH: output parent and ancestors must be existing directories without symlinks");
    }
  }
  const rootStat = await lstatOrNull(root);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
    throw Error("PORTABILITY_OUTPUT_PATH: invalid filesystem root");
  }
}

async function protectedRoots(): Promise<string[]> {
  // Resolve from both source and bundled Node locations without invoking config migration.
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot =
    path.basename(moduleDir) === "dist" ? path.resolve(moduleDir, "..") : path.resolve(moduleDir, "..", "..", "..");
  const roots = [anchorHome, knowledgeHome, pluginRoot];
  try {
    const config = JSON.parse(await fs.readFile(path.join(anchorHome, "config.json"), "utf8")) as {
      hub_path?: unknown;
    };
    if (typeof config.hub_path === "string" && config.hub_path) roots.push(path.resolve(config.hub_path));
  } catch (error) {
    if (codeOf(error) !== "ENOENT") {
      throw Error("PORTABILITY_OUTPUT_PATH: existing Hub configuration is unreadable; fix it before export");
    }
  }
  const possibleRepository = path.resolve(pluginRoot, "..", "..");
  try {
    const metadata = JSON.parse(await fs.readFile(path.join(possibleRepository, "package.json"), "utf8")) as {
      name?: unknown;
    };
    if (metadata.name === "usora") roots.push(possibleRepository);
  } catch {
    // Installed plugins do not carry the monorepo package.
  }
  const protectedPaths = new Set<string>();
  for (const configuredRoot of roots) {
    const root = path.resolve(configuredRoot);
    protectedPaths.add(root);
    // A configured Hub may name a symlink alias while the caller names its real directory.
    // Canonicalize the nearest existing ancestor even when the final Hub path does not exist yet.
    let existing = root;
    const suffix: string[] = [];
    for (;;) {
      try {
        const canonical = await fs.realpath(existing);
        protectedPaths.add(path.join(canonical, ...suffix));
        break;
      } catch (error) {
        if (codeOf(error) !== "ENOENT") {
          throw Error("PORTABILITY_OUTPUT_PATH: cannot resolve protected Hub/plugin paths safely");
        }
        const parent = path.dirname(existing);
        if (parent === existing) throw Error("PORTABILITY_OUTPUT_PATH: protected path has no accessible root");
        suffix.unshift(path.basename(existing));
        existing = parent;
      }
    }
  }
  return [...protectedPaths];
}

async function outputTarget(outputPath: unknown, name: string, format: ExportFormat): Promise<string> {
  if (
    typeof outputPath !== "string" ||
    !path.isAbsolute(outputPath) ||
    (path.sep !== "\\" && outputPath.includes("\\")) ||
    [...outputPath].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ||
    /^[\\/]{2}/.test(outputPath) ||
    outputPath.split(/[\\/]/).some((part) => part === "..")
  ) {
    throw Error(
      "PORTABILITY_OUTPUT_PATH: output_path must be an existing absolute directory without traversal or Windows/UNC syntax",
    );
  }
  const parent = path.resolve(outputPath);
  await assertRealDirectoryAncestors(parent);
  const target = path.join(parent, format === "zip" ? `${name}.zip` : name);
  for (const root of await protectedRoots()) {
    if (contains(root, parent) || contains(root, target) || contains(target, root)) {
      throw Error(
        "PORTABILITY_OUTPUT_PATH: output must not overlap Hub data, plugin files, or the Usora source repository",
      );
    }
  }
  return target;
}

async function assertTargetType(target: string, format: ExportFormat): Promise<boolean> {
  const stat = await lstatOrNull(target);
  if (!stat) return false;
  if (stat.isSymbolicLink() || (format === "directory" ? !stat.isDirectory() : !stat.isFile())) {
    throw Error(
      "PORTABILITY_OUTPUT_PATH: existing export target must have the expected type and must not be a symlink",
    );
  }
  return true;
}

function assertSnapshot(snapshot: SkillSnapshot): void {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(snapshot.name) ||
    snapshot.name.length > 64 ||
    snapshot.source.skill_id !== snapshot.name ||
    snapshot.source.state !== "PUBLISHED" ||
    !snapshot.files.some((file) => file.path === "SKILL.md")
  )
    throw Error("PORTABILITY_SNAPSHOT: a validated published Skill snapshot is required");
  validateArchivePaths(snapshot.files.map((file) => `${snapshot.name}/${file.path}`));
  let bytes = 0;
  if (snapshot.files.length > 100) throw Error("PORTABILITY_SNAPSHOT: snapshot exceeds 100 files");
  for (const file of snapshot.files) {
    if (!Buffer.isBuffer(file.data) || file.data.length > 1024 * 1024)
      throw Error("PORTABILITY_SNAPSHOT: invalid or oversized file buffer");
    bytes += file.data.length;
  }
  if (bytes > 16 * 1024 * 1024) throw Error("PORTABILITY_SNAPSHOT: snapshot exceeds 16 MiB");
}

/** Commit a validated immutable snapshot without reading or changing the source Skill. */
export async function exportSkillSnapshot(
  snapshot: SkillSnapshot,
  report: ValidationResult,
  args: Record<string, unknown>,
): Promise<ExportResult> {
  const format = args.format ?? "directory";
  const conflictPolicy = args.conflict ?? "error";
  const dryRun = args.dry_run ?? false;
  if (format !== "directory" && format !== "zip") throw Error("PORTABILITY_ARGUMENT: format must be directory or zip");
  if (conflictPolicy !== "error" && conflictPolicy !== "overwrite")
    throw Error("PORTABILITY_ARGUMENT: conflict must be error or overwrite");
  if (typeof dryRun !== "boolean") throw Error("PORTABILITY_ARGUMENT: dry_run must be boolean");
  const base: ExportResult = { ...report, exported: false, dry_run: dryRun, target: null, format, conflict: false };
  if (!report.valid || report.errors.length) return base;
  assertSnapshot(snapshot);
  const target = await outputTarget(args.output_path, snapshot.name, format);
  const exists = await assertTargetType(target, format);
  const preview = { ...base, target, conflict: exists };
  if (dryRun) return preview;
  if (exists && conflictPolicy === "error")
    throw Error("PORTABILITY_CONFLICT: export target exists; choose another parent or explicit conflict=overwrite");

  const parent = path.dirname(target);
  const lock = path.join(parent, `.usora-export-${path.basename(target)}.lock`);
  try {
    await fs.mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if (codeOf(error) === "EEXIST")
      throw Error("PORTABILITY_EXPORT_BUSY: another export owns this target; retry after it finishes");
    throw Error(`PORTABILITY_EXPORT_FAILED: cannot claim target (${codeOf(error) || "I/O error"})`);
  }

  let stage: string | null = null;
  let backup: string | null = null;
  let preserveBackup = false;
  let sha256: string | undefined;
  try {
    await outputTarget(args.output_path, snapshot.name, format);
    if ((await assertTargetType(target, format)) && conflictPolicy === "error") {
      throw Error("PORTABILITY_CONFLICT: target appeared during export");
    }
    stage = await fs.mkdtemp(path.join(parent, `.usora-export-${snapshot.name}-`));
    const payload = path.join(stage, "payload");
    if (format === "zip") {
      const archive = deterministicZip(
        snapshot.files.map((file) => ({ ...file, path: `${snapshot.name}/${file.path}` })),
      );
      sha256 = createHash("sha256").update(archive).digest("hex");
      await fs.writeFile(payload, archive, { flag: "wx", mode: 0o644 });
    } else {
      await fs.mkdir(payload);
      for (const file of snapshot.files) {
        const full = path.join(payload, ...file.path.split("/"));
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, file.data, { flag: "wx", mode: (file.mode ?? 0o644) & 0o777 });
        await fs.chmod(full, (file.mode ?? 0o644) & 0o777);
      }
    }
    await outputTarget(args.output_path, snapshot.name, format);
    if (await assertTargetType(target, format)) {
      if (conflictPolicy === "error") throw Error("PORTABILITY_CONFLICT: target appeared during staging");
      backup = path.join(stage, "previous");
      await fs.rename(target, backup);
    }
    try {
      await fs.rename(payload, target);
    } catch (error) {
      if (backup) {
        try {
          await fs.rename(backup, target);
          backup = null;
        } catch {
          preserveBackup = true;
          throw Error(`PORTABILITY_EXPORT_FAILED: commit and rollback failed; original target preserved at ${backup}`);
        }
      }
      throw error;
    }
    return { ...preview, exported: true, ...(sha256 ? { sha256 } : {}) };
  } catch (error) {
    if (error instanceof Error && /^(?:PORTABILITY_|ZIP_)/.test(error.message)) throw error;
    throw Error(`PORTABILITY_EXPORT_FAILED: export was not committed (${codeOf(error) || "I/O error"})`);
  } finally {
    try {
      if (stage && !preserveBackup) await fs.rm(stage, { recursive: true, force: true });
    } finally {
      await fs.rm(lock, { recursive: true, force: true });
    }
  }
}
