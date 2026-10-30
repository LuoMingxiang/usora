import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { test, vi } from "vitest";
import { deterministicZip } from "../../packages/shared/src/zip.ts";
import { exportSkillSnapshot } from "../../plugins/foundry/src/core/portability/export.ts";
import type { SkillSnapshot, ValidationResult } from "../../plugins/foundry/src/core/portability/types.ts";

const markdown = Buffer.from(
  "---\nname: portable-demo\ndescription: Write a deterministic report.\n---\n\n# Report\nRead the task and write the report.\n",
);

function snapshot(): SkillSnapshot {
  return {
    name: "portable-demo",
    source: { skill_id: "portable-demo", state: "PUBLISHED", revision: 2 },
    files: [
      { path: "SKILL.md", data: markdown, mode: 0o644 },
      { path: "references/中文 notes.md", data: Buffer.from("# 说明\nKeep these bytes.\r\n"), mode: 0o644 },
      { path: "scripts/report.sh", data: Buffer.from("#!/bin/sh\nprintf 'report\\n'\n"), mode: 0o755 },
    ],
  };
}

function report(skill = snapshot()): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    files: skill.files.map((file) => ({
      path: file.path,
      bytes: file.data.length,
      sha256: createHash("sha256").update(file.data).digest("hex"),
    })),
    dependencies: [],
    compatibility: { agent_skills: true, independent: true, notes: ["Static eligibility only."] },
  };
}

async function temp(t: { onTestFinished: (fn: () => Promise<void>) => void }): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "usora-export-unit-"));
  t.onTestFinished(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test("directory export writes snapshot bytes and executable mode without empty directories", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  const result = await exportSkillSnapshot(skill, report(skill), { output_path: root });
  assert.equal(result.exported, true);
  assert.equal(result.target, path.join(root, skill.name));
  assert.equal(result.format, "directory");
  for (const file of skill.files) {
    assert.deepEqual(await fs.readFile(path.join(result.target, file.path)), file.data);
  }
  assert.equal((await fs.stat(path.join(result.target, "scripts/report.sh"))).mode & 0o777, 0o755);
  assert.deepEqual((await fs.readdir(result.target)).sort(), ["SKILL.md", "references", "scripts"]);
  assert.deepEqual(await fs.readdir(root), [skill.name]);
});

test("ZIP export has one root and independent Python verifies names, bytes, CRC, UTF-8 and modes", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  const result = await exportSkillSnapshot(skill, report(skill), { output_path: root, format: "zip" });
  assert.equal(result.exported, true);
  const zip = await fs.readFile(result.target);
  assert.equal(result.sha256, createHash("sha256").update(zip).digest("hex"));
  const decoded = JSON.parse(
    execFileSync(
      "python3",
      [
        "-c",
        [
          "import base64,json,sys,zipfile",
          "with zipfile.ZipFile(sys.argv[1]) as z:",
          " assert z.testzip() is None",
          " print(json.dumps([{'name':i.filename,'flags':i.flag_bits,'mode':i.external_attr >> 16,'data':base64.b64encode(z.read(i)).decode()} for i in z.infolist()]))",
        ].join("\n"),
        result.target,
      ],
      { encoding: "utf8" },
    ),
  ) as { name: string; flags: number; mode: number; data: string }[];
  assert.deepEqual(
    decoded.map((entry) => entry.name),
    skill.files.map((file) => `${skill.name}/${file.path}`).sort(),
  );
  for (const entry of decoded) {
    const file = skill.files.find((item) => entry.name === `${skill.name}/${item.path}`)!;
    assert.deepEqual(Buffer.from(entry.data, "base64"), file.data);
    assert.equal(entry.flags & 0x800, 0x800);
    assert.equal(entry.mode & 0o777, file.mode);
    assert.ok(!entry.name.endsWith("/"));
  }
  assert.deepEqual(await fs.readdir(root), [`${skill.name}.zip`]);
});

test("repeated ZIP exports produce identical bytes regardless of entry input order", async (t) => {
  const root = await temp(t);
  const first = snapshot();
  const original = first.files.map((file) => ({
    path: `${first.name}/${file.path}`,
    data: file.data,
    mode: file.mode,
  }));
  assert.deepEqual(deterministicZip(original), deterministicZip([...original].reverse()));
  const initial = await exportSkillSnapshot(first, report(first), { output_path: root, format: "zip" });
  const initialBytes = await fs.readFile(initial.target);
  const second = await exportSkillSnapshot(first, report(first), {
    output_path: root,
    format: "zip",
    conflict: "overwrite",
  });
  assert.deepEqual(await fs.readFile(second.target), initialBytes);
  assert.equal(second.sha256, initial.sha256);
});

test("dry run creates no files and previews the exact target", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  const result = await exportSkillSnapshot(skill, report(skill), { output_path: root, dry_run: true });
  assert.equal(result.exported, false);
  assert.equal(result.dry_run, true);
  assert.equal(result.target, path.join(root, skill.name));
  assert.deepEqual(await fs.readdir(root), []);
});

test("directory conflict does not overwrite default target or unrelated sibling", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  await fs.mkdir(path.join(root, skill.name));
  await fs.writeFile(path.join(root, skill.name, "preserve.txt"), "previous export");
  await fs.writeFile(path.join(root, "unrelated.txt"), "keep");
  await assert.rejects(exportSkillSnapshot(skill, report(skill), { output_path: root }), /CONFLICT|EXISTS/);
  assert.equal(await fs.readFile(path.join(root, skill.name, "preserve.txt"), "utf8"), "previous export");
  assert.equal(await fs.readFile(path.join(root, "unrelated.txt"), "utf8"), "keep");
  assert.deepEqual((await fs.readdir(root)).sort(), [skill.name, "unrelated.txt"]);
});

test("dry run reports an existing-target conflict without overwriting or staging", async (t) => {
  const root = await temp(t);
  const target = path.join(root, "portable-demo");
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "keep"), "preserved");
  const result = await exportSkillSnapshot(snapshot(), report(), { output_path: root, dry_run: true });
  assert.equal(result.exported, false);
  assert.equal(result.dry_run, true);
  assert.equal(result.conflict, true);
  assert.equal(await fs.readFile(path.join(target, "keep"), "utf8"), "preserved");
  assert.deepEqual(await fs.readdir(root), ["portable-demo"]);
});

test("explicit directory overwrite replaces only the exact Skill target", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  await fs.mkdir(path.join(root, skill.name));
  await fs.writeFile(path.join(root, skill.name, "stale.txt"), "remove only this target");
  await fs.writeFile(path.join(root, "unrelated.txt"), "keep");
  const result = await exportSkillSnapshot(skill, report(skill), { output_path: root, conflict: "overwrite" });
  assert.equal(result.exported, true);
  await assert.rejects(fs.stat(path.join(root, skill.name, "stale.txt")), /ENOENT/);
  assert.deepEqual(await fs.readFile(path.join(root, skill.name, "SKILL.md")), markdown);
  assert.equal(await fs.readFile(path.join(root, "unrelated.txt"), "utf8"), "keep");
  assert.deepEqual((await fs.readdir(root)).sort(), [skill.name, "unrelated.txt"]);
});

test("ZIP conflict preserves original bytes and explicit overwrite replaces them", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  const target = path.join(root, `${skill.name}.zip`);
  await fs.writeFile(target, "keep archive");
  await assert.rejects(
    exportSkillSnapshot(skill, report(skill), { output_path: root, format: "zip" }),
    /CONFLICT|EXISTS/,
  );
  assert.equal(await fs.readFile(target, "utf8"), "keep archive");
  await exportSkillSnapshot(skill, report(skill), { output_path: root, format: "zip", conflict: "overwrite" });
  assert.equal((await fs.readFile(target)).readUInt32LE(0), 0x04034b50);
  assert.deepEqual(await fs.readdir(root), [`${skill.name}.zip`]);
});

test("failed atomic commit rolls back overwritten target and cleans temporary files", async (t) => {
  const root = await temp(t);
  const target = path.join(root, "portable-demo");
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "keep"), "restore after failure");
  const rename = fs.rename;
  let injected = false;
  const spy = vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (String(to) === target && !injected) {
      injected = true;
      throw Object.assign(new Error("injected commit failure"), { code: "EIO" });
    }
    return rename(from, to);
  });
  try {
    await assert.rejects(
      exportSkillSnapshot(snapshot(), report(), { output_path: root, conflict: "overwrite" }),
      /PORTABILITY_EXPORT_FAILED/,
    );
  } finally {
    spy.mockRestore();
  }
  assert.equal(injected, true);
  assert.equal(await fs.readFile(path.join(target, "keep"), "utf8"), "restore after failure");
  assert.deepEqual(await fs.readdir(target), ["keep"]);
  assert.deepEqual(await fs.readdir(root), ["portable-demo"]);
});

test("committed directory export reports staging cleanup failure and preserves its backup path", async (t) => {
  const root = await temp(t);
  const target = path.join(root, "portable-demo");
  const lock = path.join(root, ".usora-export-portable-demo.lock");
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "keep"), "previous target");
  const remove = fs.rm;
  let stage = "";
  const spy = vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (path.dirname(String(file)) === root && String(file) !== lock) {
      stage = String(file);
      throw Object.assign(new Error("injected staging cleanup failure"), { code: "EACCES" });
    }
    return remove(file, options);
  });
  let result;
  try {
    result = await exportSkillSnapshot(snapshot(), report(), { output_path: root, conflict: "overwrite" });
  } finally {
    spy.mockRestore();
  }
  assert.equal(result.exported, true);
  assert.ok(stage);
  assert.ok(result.warnings.some((warning) => warning.code === "EXPORT_CLEANUP_FAILED"));
  assert.deepEqual(result.recovery?.cleanup, [{ path: stage, code: "EACCES" }]);
  assert.equal(result.recovery?.backup_path, path.join(stage, "previous"));
  assert.equal(result.recovery?.lock_path, undefined);
  assert.equal(await fs.readFile(path.join(stage, "previous", "keep"), "utf8"), "previous target");
  assert.deepEqual(await fs.readFile(path.join(target, "SKILL.md")), markdown);
  await assert.rejects(fs.lstat(lock), /ENOENT/);
});

test("committed export reports lock cleanup failure without misreporting the artifact as failed", async (t) => {
  const root = await temp(t);
  const target = path.join(root, "portable-demo");
  const lock = path.join(root, ".usora-export-portable-demo.lock");
  const remove = fs.rm;
  const spy = vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (String(file) === lock) throw Object.assign(new Error("injected lock cleanup failure"), { code: "EACCES" });
    return remove(file, options);
  });
  let result;
  try {
    result = await exportSkillSnapshot(snapshot(), report(), { output_path: root });
  } finally {
    spy.mockRestore();
  }
  assert.equal(result.exported, true);
  assert.ok(result.warnings.some((warning) => warning.code === "EXPORT_CLEANUP_FAILED"));
  assert.deepEqual(result.recovery?.cleanup, [{ path: lock, code: "EACCES" }]);
  assert.equal(result.recovery?.lock_path, lock);
  assert.deepEqual(await fs.readFile(path.join(target, "SKILL.md")), markdown);
  assert.deepEqual((await fs.readdir(root)).sort(), [path.basename(lock), "portable-demo"]);
});

test("commit and rollback failures retain the backup recovery message when lock cleanup also fails", async (t) => {
  const root = await temp(t);
  const target = path.join(root, "portable-demo");
  const lock = path.join(root, ".usora-export-portable-demo.lock");
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "keep"), "recover these original bytes");
  const rename = fs.rename;
  const remove = fs.rm;
  let backup = "";
  let failure: unknown;
  const renameSpy = vi.spyOn(fs, "rename").mockImplementation(async (from, to) => {
    if (String(to) === target) {
      if (path.basename(String(from)) === "previous") backup = String(from);
      throw Object.assign(new Error("injected commit or rollback failure"), { code: "EACCES" });
    }
    return rename(from, to);
  });
  const removeSpy = vi.spyOn(fs, "rm").mockImplementation(async (file, options) => {
    if (String(file) === lock) throw Object.assign(new Error("injected lock cleanup failure"), { code: "EACCES" });
    return remove(file, options);
  });
  try {
    await exportSkillSnapshot(snapshot(), report(), { output_path: root, conflict: "overwrite" });
  } catch (error) {
    failure = error;
  } finally {
    renameSpy.mockRestore();
    removeSpy.mockRestore();
  }
  assert.ok(backup);
  assert.match(String(failure), /PORTABILITY_EXPORT_FAILED: commit and rollback failed/);
  assert.ok(String(failure).includes(`original target preserved at ${backup}`));
  assert.ok(String(failure).includes(lock));
  assert.match(String(failure), /EACCES/);
  assert.equal(await fs.readFile(path.join(backup, "keep"), "utf8"), "recover these original bytes");
  await assert.rejects(fs.lstat(target), /ENOENT/);
  assert.equal((await fs.lstat(lock)).isDirectory(), true);
});

test("a preexisting export lock remains owned and reports a precise safe recovery instruction", async (t) => {
  const root = await temp(t);
  const lock = path.join(root, ".usora-export-portable-demo.lock");
  await fs.mkdir(lock);
  await fs.writeFile(path.join(lock, "owner"), "another export");
  await fs.utimes(lock, new Date("2000-01-01T00:00:00Z"), new Date("2000-01-01T00:00:00Z"));
  await assert.rejects(exportSkillSnapshot(snapshot(), report(), { output_path: root }), (error) => {
    assert.match(String(error), /PORTABILITY_EXPORT_BUSY/);
    assert.ok(String(error).includes(lock));
    assert.match(String(error), /confirm/i);
    assert.match(String(error), /stopped|finished/i);
    return true;
  });
  assert.equal(await fs.readFile(path.join(lock, "owner"), "utf8"), "another export");
  assert.deepEqual(await fs.readdir(root), [path.basename(lock)]);
});

test("ZIP default publication never clobbers a late external target before the atomic link", async (t) => {
  const root = await temp(t);
  const target = path.join(root, "portable-demo.zip");
  const link = fs.link;
  let injected = false;
  const spy = vi.spyOn(fs, "link").mockImplementation(async (from, to) => {
    if (String(to) === target) {
      injected = true;
      await fs.writeFile(target, "late external target", { flag: "wx" });
    }
    return link(from, to);
  });
  try {
    await assert.rejects(
      exportSkillSnapshot(snapshot(), report(), { output_path: root, format: "zip" }),
      /PORTABILITY_CONFLICT/,
    );
  } finally {
    spy.mockRestore();
  }
  assert.equal(injected, true);
  assert.equal(await fs.readFile(target, "utf8"), "late external target");
  assert.deepEqual(await fs.readdir(root), ["portable-demo.zip"]);
});

test("invalid validation report cannot write an artifact", async (t) => {
  const root = await temp(t);
  const invalid = report();
  invalid.valid = false;
  invalid.errors.push({ code: "SECRET_DETECTED", message: "redacted" });
  try {
    const result = await exportSkillSnapshot(snapshot(), invalid, { output_path: root });
    assert.equal(result.exported, false);
  } catch (error) {
    assert.match(String(error), /INVALID|VALIDATION|SECRET/);
  }
  assert.deepEqual(await fs.readdir(root), []);
});

test("malformed snapshot records fail with an actionable guard error before writing", async (t) => {
  const root = await temp(t);
  const cases: unknown[] = [
    null,
    {},
    { ...snapshot(), source: undefined },
    { ...snapshot(), source: null },
    { ...snapshot(), source: { ...snapshot().source, revision: 0 } },
    { ...snapshot(), source: { ...snapshot().source, revision: Number.NaN } },
    { ...snapshot(), source: { ...snapshot().source, revision: -1 } },
    { ...snapshot(), files: null },
    { ...snapshot(), files: [null] },
    { ...snapshot(), files: [{ path: "SKILL.md", data: "not a Buffer" }] },
    { ...snapshot(), files: [{ path: 42, data: markdown }] },
    { ...snapshot(), files: [{ path: "SKILL.md", data: markdown, mode: Number.NaN }] },
  ];
  for (const malformed of cases) {
    await assert.rejects(exportSkillSnapshot(malformed as SkillSnapshot, report(), { output_path: root }), (error) => {
      assert.match(String(error), /PORTABILITY_SNAPSHOT/);
      assert.ok(!(error instanceof TypeError));
      return true;
    });
    assert.deepEqual(await fs.readdir(root), []);
  }
});

test("export ignores unknown report callbacks and debug fields while retaining validated evidence", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  const validation = report(skill);
  validation.warnings.push({ code: "OPTIONAL_NOTE", message: "Retain this diagnostic.", file: "SKILL.md" });
  validation.dependencies.push({ kind: "runtime", name: "optional-example", required: false, reason: "An example." });
  const expected = JSON.parse(JSON.stringify(validation)) as ValidationResult;
  Object.assign(validation, { callback: () => "ignored", debug: { callback: () => "ignored" } });
  Object.assign(validation.files[0]!, { callback: () => "ignored", debug: { trace: true } });
  Object.assign(validation.warnings[0]!, { callback: () => "ignored", debug: { trace: true } });
  Object.assign(validation.dependencies[0]!, { callback: () => "ignored", debug: { trace: true } });
  Object.assign(validation.compatibility, { callback: () => "ignored", debug: { trace: true } });
  const result = await exportSkillSnapshot(skill, validation, { output_path: root });
  assert.equal(result.exported, true);
  assert.deepEqual(
    {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      files: result.files,
      dependencies: result.dependencies,
      compatibility: result.compatibility,
    },
    expected,
  );
  assert.deepEqual(Object.keys(result).sort(), [
    "compatibility",
    "conflict",
    "dependencies",
    "dry_run",
    "errors",
    "exported",
    "files",
    "format",
    "target",
    "valid",
    "warnings",
  ]);
  assert.deepEqual(await fs.readFile(path.join(result.target, "SKILL.md")), markdown);
});

test("snapshot export rejects report file evidence with mismatched hash, bytes, path or duplicates", async (t) => {
  const root = await temp(t);
  for (const mismatch of ["hash", "bytes", "path", "duplicate", "missing"] as const) {
    const skill = snapshot();
    const validation = report(skill);
    const first = validation.files[0]!;
    if (mismatch === "hash") first.sha256 = "0".repeat(64);
    if (mismatch === "bytes") first.bytes += 1;
    if (mismatch === "path") first.path = "assets/other.txt";
    if (mismatch === "duplicate") validation.files.push({ ...first });
    if (mismatch === "missing") validation.files.pop();
    await assert.rejects(
      exportSkillSnapshot(skill, validation, { output_path: root }),
      /PORTABILITY_SNAPSHOT/,
      mismatch,
    );
    assert.deepEqual(await fs.readdir(root), [], mismatch);
  }
});

test("export captures snapshot buffers, validation evidence and output parent before asynchronous work", async (t) => {
  const root = await temp(t);
  const redirect = await temp(t);
  const skill = snapshot();
  const validation = report(skill);
  const originalReport = JSON.parse(JSON.stringify(validation)) as ValidationResult;
  const originalFiles = skill.files.map((file) => ({ path: file.path, data: Buffer.from(file.data) }));
  const args = { output_path: root };
  const pending = exportSkillSnapshot(skill, validation, args);
  for (const file of skill.files) file.data.fill(0x78);
  skill.files[0]!.path = "assets/changed.txt";
  skill.files.splice(0, skill.files.length, { path: "assets/replacement.txt", data: Buffer.from("replacement") });
  skill.name = "changed-name";
  skill.source.skill_id = "changed-name";
  skill.source.state = "DRAFT";
  skill.source.revision = 99;
  validation.files[0]!.path = "assets/changed.txt";
  validation.files[0]!.bytes = 0;
  validation.files[0]!.sha256 = "0".repeat(64);
  validation.files.reverse();
  validation.warnings.push({ code: "CALLER_MUTATION", message: "not part of validated evidence" });
  validation.errors.push({ code: "CALLER_MUTATION", message: "not part of validated evidence" });
  validation.dependencies.push({ kind: "runtime", name: "changed-runtime", required: true, reason: "mutated" });
  validation.compatibility.independent = false;
  validation.compatibility.notes.push("mutated note");
  validation.valid = false;
  args.output_path = redirect;
  const result = await pending;
  assert.equal(result.exported, true);
  assert.equal(result.target, path.join(root, "portable-demo"));
  for (const file of originalFiles) {
    assert.deepEqual(await fs.readFile(path.join(result.target, file.path)), file.data);
  }
  assert.equal(result.valid, originalReport.valid);
  assert.deepEqual(result.files, originalReport.files);
  assert.deepEqual(result.errors, originalReport.errors);
  assert.deepEqual(result.warnings, originalReport.warnings);
  assert.deepEqual(result.dependencies, originalReport.dependencies);
  assert.deepEqual(result.compatibility, originalReport.compatibility);
  assert.deepEqual(await fs.readdir(root), ["portable-demo"]);
  assert.deepEqual(await fs.readdir(redirect), []);
});

test("output parent must exist, be absolute and be a directory", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  await fs.writeFile(path.join(root, "file"), "not a directory");
  for (const output_path of [
    "relative/exports",
    path.join(root, "missing"),
    path.join(root, "file"),
    "C:\\exports",
    "\\\\server\\share",
  ]) {
    await assert.rejects(
      exportSkillSnapshot(skill, report(skill), { output_path }),
      /OUTPUT|PATH|DIRECTORY|ENOENT|ENOTDIR/,
    );
  }
  assert.deepEqual(await fs.readdir(root), ["file"]);
});

test("output parent symlink and symlink ancestor are rejected without writes", async (t) => {
  const root = await temp(t);
  const real = path.join(root, "real");
  const linked = path.join(root, "linked");
  await fs.mkdir(path.join(real, "nested"), { recursive: true });
  await fs.symlink(real, linked, "dir");
  for (const output_path of [linked, path.join(linked, "nested")]) {
    await assert.rejects(exportSkillSnapshot(snapshot(), report(), { output_path }), /SYMLINK|PATH|OUTPUT/);
  }
  assert.deepEqual(await fs.readdir(real), ["nested"]);
  assert.deepEqual(await fs.readdir(path.join(real, "nested")), []);
});

test("canonical output cannot overlap a symlink-aliased host or Knowledge Hub", async (t) => {
  const root = await temp(t);
  const exporter = pathToFileURL(path.resolve("plugins/foundry/src/core/portability/export.ts")).href;
  for (const kind of ["host", "knowledge", "future-host"] as const) {
    const fixture = path.join(root, kind);
    const host = path.join(fixture, "host");
    const realHub = path.join(fixture, "real-hub");
    const alias = path.join(fixture, "hub-alias");
    await fs.mkdir(path.join(host, ".usora"), { recursive: true });
    await fs.mkdir(realHub);
    await fs.symlink(realHub, alias, "dir");
    const hubPath = kind === "future-host" ? path.join(alias, "portable-demo", "not-yet-created") : alias;
    await fs.writeFile(path.join(host, ".usora", "config.json"), JSON.stringify({ hub_path: hubPath }));
    const script = [
      `import { exportSkillSnapshot } from ${JSON.stringify(exporter)};`,
      `const snapshot = ${JSON.stringify({ name: "portable-demo", source: { skill_id: "portable-demo", state: "PUBLISHED", revision: 2 } })};`,
      `snapshot.files = [{ path: "SKILL.md", data: Buffer.from(${JSON.stringify(markdown.toString("utf8"))}) }];`,
      `const report = ${JSON.stringify(report({ ...snapshot(), files: [{ path: "SKILL.md", data: markdown }] }))};`,
      "try {",
      ` await exportSkillSnapshot(snapshot, report, { output_path: ${JSON.stringify(realHub)} });`,
      " console.log(JSON.stringify({ rejected: false }));",
      "} catch (error) {",
      " console.log(JSON.stringify({ rejected: true, message: error.message }));",
      "}",
    ].join("\n");
    const outcome = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", script], {
        cwd: fixture,
        env: {
          ...process.env,
          CODEBUDDY_PLUGIN_DATA: "",
          PLUGIN_DATA: host,
          USORA_HOME: kind === "knowledge" ? alias : path.join(fixture, "knowledge"),
        },
        encoding: "utf8",
      }),
    ) as { rejected: boolean; message?: string };
    assert.equal(outcome.rejected, true, kind);
    assert.match(outcome.message || "", /PORTABILITY_OUTPUT_PATH/, kind);
    assert.deepEqual(await fs.readdir(realHub), [], kind);
  }
});

test("existing target symlink is rejected even with explicit overwrite", async (t) => {
  const root = await temp(t);
  const real = path.join(root, "preserve");
  await fs.mkdir(real);
  await fs.writeFile(path.join(real, "keep"), "important");
  await fs.symlink(real, path.join(root, "portable-demo"), "dir");
  await assert.rejects(
    exportSkillSnapshot(snapshot(), report(), { output_path: root, conflict: "overwrite" }),
    /SYMLINK|PATH|OUTPUT/,
  );
  assert.equal(await fs.readFile(path.join(real, "keep"), "utf8"), "important");
  assert.equal((await fs.lstat(path.join(root, "portable-demo"))).isSymbolicLink(), true);
});

test("invalid options are rejected before creating temporary output", async (t) => {
  const root = await temp(t);
  for (const options of [{ format: "tar" }, { conflict: "yes" }, { dry_run: "true" }]) {
    await assert.rejects(
      exportSkillSnapshot(snapshot(), report(), { output_path: root, ...options }),
      /ARGUMENT|FORMAT|CONFLICT|dry_run|format|conflict/,
    );
  }
  assert.deepEqual(await fs.readdir(root), []);
});

test("ZIP helper rejects unsafe, duplicate and case-colliding entries", () => {
  for (const name of [
    "../escape",
    "/absolute",
    "C:/drive",
    "\\\\host\\share",
    "root/../escape",
    "root\\escape",
    "root//file",
    "root/./file",
    "root/file\u0000name",
  ]) {
    assert.throws(() => deterministicZip([{ path: name, data: Buffer.from("x") }]), /PATH|ZIP|entry|path/i);
  }
  assert.throws(
    () =>
      deterministicZip([
        { path: "root/file", data: markdown },
        { path: "root/file", data: markdown },
      ]),
    /DUPLICATE|ZIP|duplicate/i,
  );
  assert.throws(
    () =>
      deterministicZip([
        { path: "root/File", data: markdown },
        { path: "root/file", data: markdown },
      ]),
    /DUPLICATE|ZIP|duplicate/i,
  );
});

test("ZIP helper rejects ZIP32 filename/count bounds and file/directory collisions", () => {
  assert.throws(
    () => deterministicZip([{ path: `root/${"a".repeat(65_536)}`, data: Buffer.alloc(0) }]),
    /ZIP_PATH|ZIP_LIMIT/,
  );
  const entry = { path: "root/file", data: Buffer.alloc(0) };
  assert.throws(() => deterministicZip(Array.from({ length: 65_536 }, () => entry)), /ZIP_LIMIT/);
  assert.throws(() => deterministicZip([entry, { path: "root/file/nested", data: markdown }]), /ZIP_PATH|collision/);
  for (const name of ["root/CON.txt", "root/nul", "root/trailing.", "root/trailing "]) {
    assert.throws(() => deterministicZip([{ path: name, data: markdown }]), /ZIP_PATH/);
  }
});

test("ZIP helper rejects malformed surrogate filenames and preserves supplementary Unicode", () => {
  for (const filename of ["root/\ud800.txt", "root/\udfff.txt", "root/a\udbffz.txt"]) {
    assert.throws(() => deterministicZip([{ path: filename, data: markdown }]), /ZIP_PATH/);
  }
  assert.throws(
    () =>
      deterministicZip([
        { path: "root/\ud800.txt", data: markdown },
        { path: "root/\ud801.txt", data: markdown },
      ]),
    /ZIP_PATH|ZIP_DUPLICATE/,
  );
  const filename = "root/\u{1f680}补充说明.md";
  const archive = deterministicZip([{ path: filename, data: markdown }]);
  const nameLength = archive.readUInt16LE(26);
  assert.equal(archive.subarray(30, 30 + nameLength).toString("utf8"), filename);
  assert.equal(archive.readUInt16LE(6) & 0x800, 0x800);
});

test("unsafe snapshot paths and duplicate entries cannot escape the target", async (t) => {
  const root = await temp(t);
  for (const filePath of ["../escape", "/absolute", "C:/drive", "assets/../../escape", "assets\\escape"]) {
    const skill = snapshot();
    skill.files.push({ path: filePath, data: Buffer.from("bad") });
    await assert.rejects(
      exportSkillSnapshot(skill, report(skill), { output_path: root }),
      /PATH|SNAPSHOT|FILE|ZIP|entry/i,
    );
  }
  const duplicate = snapshot();
  duplicate.files.push({ path: "SKILL.md", data: markdown });
  await assert.rejects(
    exportSkillSnapshot(duplicate, report(duplicate), { output_path: root }),
    /DUPLICATE|SNAPSHOT|FILE|ZIP/i,
  );
  assert.deepEqual(await fs.readdir(root), []);
});

test("concurrent exports yield one complete target and no lock or staging debris", async (t) => {
  const root = await temp(t);
  const skill = snapshot();
  const results = await Promise.allSettled([
    exportSkillSnapshot(skill, report(skill), { output_path: root }),
    exportSkillSnapshot(skill, report(skill), { output_path: root }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.deepEqual(await fs.readFile(path.join(root, skill.name, "SKILL.md")), markdown);
  assert.deepEqual(await fs.readdir(root), [skill.name]);
});
