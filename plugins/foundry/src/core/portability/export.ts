import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { deterministicZip, validateArchivePaths } from "../../../../../packages/shared/src/zip.ts";
import { anchorHome, knowledgeHome } from "../storage.ts";
import type { SkillSnapshot, ValidationResult } from "./types.ts";

type ExportFormat = "directory" | "zip";
type CleanupIssue = { path: string; code: string };
type ExportResult = ValidationResult & {
  exported: boolean;
  dry_run: boolean;
  target: string | null;
  format: ExportFormat;
  conflict: boolean;
  sha256?: string;
  recovery?: {
    cleanup: CleanupIssue[];
    backup_path?: string;
    lock_path?: string;
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function diagnostic(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    (value.file === undefined || typeof value.file === "string")
  );
}

function copyReport(value: unknown): ValidationResult {
  if (
    !isRecord(value) ||
    typeof value.valid !== "boolean" ||
    !Array.isArray(value.errors) ||
    !value.errors.every(diagnostic) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(diagnostic) ||
    !Array.isArray(value.files) ||
    !value.files.every(
      (file: unknown) =>
        isRecord(file) &&
        typeof file.path === "string" &&
        Number.isSafeInteger(file.bytes) &&
        typeof file.bytes === "number" &&
        file.bytes >= 0 &&
        typeof file.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(file.sha256),
    ) ||
    !Array.isArray(value.dependencies) ||
    !value.dependencies.every(
      (dependency: unknown) =>
        isRecord(dependency) &&
        typeof dependency.kind === "string" &&
        ["usora_mcp", "mcp", "runtime", "platform", "external_service", "credential", "dynamic_resource"].includes(
          dependency.kind,
        ) &&
        typeof dependency.name === "string" &&
        typeof dependency.required === "boolean" &&
        typeof dependency.reason === "string",
    ) ||
    !isRecord(value.compatibility) ||
    typeof value.compatibility.agent_skills !== "boolean" ||
    typeof value.compatibility.independent !== "boolean" ||
    !Array.isArray(value.compatibility.notes) ||
    !value.compatibility.notes.every((note: unknown) => typeof note === "string")
  )
    throw Error("PORTABILITY_SNAPSHOT: a complete validation report is required");
  return {
    valid: value.valid,
    errors: value.errors.map(({ code, message, file }) => ({ code, message, ...(file !== undefined ? { file } : {}) })),
    warnings: value.warnings.map(({ code, message, file }) => ({
      code,
      message,
      ...(file !== undefined ? { file } : {}),
    })),
    files: value.files.map(({ path: filePath, bytes, sha256 }) => ({ path: filePath, bytes, sha256 })),
    dependencies: value.dependencies.map(({ kind, name, required, reason }) => ({ kind, name, required, reason })),
    compatibility: {
      agent_skills: value.compatibility.agent_skills,
      independent: value.compatibility.independent,
      notes: [...value.compatibility.notes],
    },
  } as ValidationResult;
}

function copySnapshot(value: unknown, report: ValidationResult): SkillSnapshot {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.name) ||
    value.name.length > 64 ||
    !isRecord(value.source) ||
    value.source.skill_id !== value.name ||
    value.source.state !== "PUBLISHED" ||
    typeof value.source.revision !== "number" ||
    !Number.isSafeInteger(value.source.revision) ||
    value.source.revision < 1 ||
    !Array.isArray(value.files) ||
    !value.files.length ||
    value.files.length > 100 ||
    !report.compatibility.agent_skills
  )
    throw Error("PORTABILITY_SNAPSHOT: a validated published Skill snapshot is required");
  let bytes = 0;
  const files = value.files.map((file: unknown) => {
    if (
      !isRecord(file) ||
      typeof file.path !== "string" ||
      !Buffer.isBuffer(file.data) ||
      file.data.length > 1024 * 1024 ||
      (file.mode !== undefined &&
        (typeof file.mode !== "number" || !Number.isSafeInteger(file.mode) || file.mode < 0 || file.mode > 0xffff))
    )
      throw Error("PORTABILITY_SNAPSHOT: invalid file path, buffer, size, or mode");
    bytes += file.data.length;
    if (bytes > 16 * 1024 * 1024) throw Error("PORTABILITY_SNAPSHOT: snapshot exceeds 16 MiB");
    return {
      path: file.path,
      data: Buffer.from(file.data),
      ...(typeof file.mode === "number" ? { mode: file.mode } : {}),
    };
  });
  if (!files.some((file) => file.path === "SKILL.md")) throw Error("PORTABILITY_SNAPSHOT: SKILL.md is required");
  validateArchivePaths(files.map((file) => `${value.name}/${file.path}`));
  const evidence = new Map(report.files.map((file) => [file.path, file]));
  if (report.files.length !== files.length || evidence.size !== files.length) {
    throw Error("PORTABILITY_SNAPSHOT: snapshot files do not match the validation report");
  }
  for (const file of files) {
    const entry = evidence.get(file.path);
    if (
      !entry ||
      entry.bytes !== file.data.length ||
      entry.sha256 !== createHash("sha256").update(file.data).digest("hex")
    ) {
      throw Error("PORTABILITY_SNAPSHOT: snapshot bytes do not match the validation report; validate again");
    }
  }
  return {
    name: value.name,
    files,
    source: { skill_id: value.name, state: "PUBLISHED", revision: value.source.revision },
  };
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
  report = copyReport(report);
  const outputPath = args.output_path;
  const base: ExportResult = { ...report, exported: false, dry_run: dryRun, target: null, format, conflict: false };
  if (!report.valid || report.errors.length) return base;
  snapshot = copySnapshot(snapshot, report);
  const target = await outputTarget(outputPath, snapshot.name, format);
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
      throw Error(
        `PORTABILITY_EXPORT_BUSY: export lock exists at ${lock}; retry after the export finishes. If a prior export stopped unexpectedly, remove this lock only after confirming that process is no longer running.`,
      );
    throw Error(`PORTABILITY_EXPORT_FAILED: cannot claim target (${codeOf(error) || "I/O error"})`);
  }

  let stage: string | null = null;
  let backup: string | null = null;
  let preserveBackup = false;
  let sha256: string | undefined;
  let committed = false;
  let primaryError: Error | null = null;
  const cleanupIssues: CleanupIssue[] = [];
  try {
    await outputTarget(outputPath, snapshot.name, format);
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
    await outputTarget(outputPath, snapshot.name, format);
    if (await assertTargetType(target, format)) {
      if (conflictPolicy === "error") throw Error("PORTABILITY_CONFLICT: target appeared during staging");
      backup = path.join(stage, "previous");
      await fs.rename(target, backup);
    }
    try {
      if (format === "zip" && conflictPolicy === "error") {
        // Creating the final hard link fails atomically if any noncooperating writer
        // creates the target after our last check. The sibling stage uses the same filesystem.
        try {
          await fs.link(payload, target);
        } catch (error) {
          if (codeOf(error) === "EEXIST") throw Error("PORTABILITY_CONFLICT: target appeared during commit");
          throw error;
        }
      } else {
        await fs.rename(payload, target);
      }
      committed = true;
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
  } catch (error) {
    primaryError =
      error instanceof Error && /^(?:PORTABILITY_|ZIP_)/.test(error.message)
        ? error
        : Error(`PORTABILITY_EXPORT_FAILED: export was not committed (${codeOf(error) || "I/O error"})`, {
            cause: error,
          });
  } finally {
    for (const leftover of [...(stage && !preserveBackup ? [stage] : []), lock]) {
      try {
        await fs.rm(leftover, { recursive: true, force: true });
      } catch (error) {
        cleanupIssues.push({ path: leftover, code: codeOf(error) || "I/O error" });
      }
    }
  }
  if (primaryError) {
    if (!cleanupIssues.length) throw primaryError;
    throw Error(
      `${primaryError.message}; cleanup incomplete: ${cleanupIssues.map((issue) => `${issue.path} (${issue.code})`).join(", ")}`,
      { cause: primaryError },
    );
  }
  if (!committed) throw Error("PORTABILITY_EXPORT_FAILED: export was not committed");
  const result: ExportResult = { ...preview, exported: true, ...(sha256 ? { sha256 } : {}) };
  if (cleanupIssues.length) {
    result.warnings = [
      ...report.warnings,
      {
        code: "EXPORT_CLEANUP_FAILED",
        message:
          "The export was committed, but temporary files or its lock could not be removed. See recovery for paths; remove a lock only after confirming its export process has stopped.",
      },
    ];
    result.recovery = {
      cleanup: cleanupIssues,
      ...(backup && stage && cleanupIssues.some((issue) => issue.path === stage) ? { backup_path: backup } : {}),
      ...(cleanupIssues.some((issue) => issue.path === lock) ? { lock_path: lock } : {}),
    };
  }
  return result;
}
