import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

const mcpScript = path.resolve("plugins/foundry/dist/mcp.js");

async function rpc(cwd: string, requests: Record<string, unknown>[], env: Record<string, string> = {}) {
  const child = spawn(process.execPath, [mcpScript], {
    cwd,
    env: {
      ...process.env,
      USORA_HOME: path.join(cwd, "knowledge"),
      PLUGIN_DATA: path.join(cwd, "host"),
      CODEBUDDY_PLUGIN_DATA: "",
      ...env,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve() : reject(Error(`MCP exited ${code}: ${stderr}`))));
    child.stdin.end(
      requests.map((request, index) => JSON.stringify({ jsonrpc: "2.0", id: index + 1, ...request })).join("\n") + "\n",
    );
  });
  return output
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

async function invoke(cwd: string, name: string, args: Record<string, unknown> = {}) {
  const [response] = await rpc(cwd, [{ method: "tools/call", params: { name, arguments: args } }]);
  if (response.error) throw Error(response.error.message);
  return JSON.parse(response.result.content[0].text);
}

async function fileTree(root: string, prefix = ""): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of (await readdir(root, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, await fileTree(path.join(root, entry.name), relative));
    else
      files[relative] = createHash("sha256")
        .update(await readFile(path.join(root, entry.name)))
        .digest("hex");
  }
  return files;
}

async function publishedSkill(cwd: string, content: string, name = "portable-demo") {
  await invoke(cwd, "hub_init", { maintainer: "test-maintainer" });
  await invoke(cwd, "skill_create", {
    name,
    description: "Use for deterministic local text formatting tasks.",
    content,
  });
  await invoke(cwd, "skill_evaluate", { name, result: "pass" });
  return invoke(cwd, "skill_publish", { name, actor: "test-maintainer" });
}

test("portability tools are discoverable and missing Hub reads have no initialization side effects", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-portability-empty-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const [listed] = await rpc(cwd, [{ method: "tools/list" }]);
  const validate = listed.result.tools.find((tool) => tool.name === "skill_validate");
  const exporting = listed.result.tools.find((tool) => tool.name === "skill_export");
  assert.deepEqual(validate.inputSchema.required, ["skill_id"]);
  assert.deepEqual(exporting.inputSchema.required, ["skill_id", "output_path"]);
  const validated = await invoke(cwd, "skill_validate", { skill_id: "absent" });
  assert.equal(validated.valid, false);
  assert.equal(validated.errors[0].code, "HUB_NOT_FOUND");
  const exported = await invoke(cwd, "skill_export", { skill_id: "absent", output_path: cwd });
  assert.equal(exported.exported, false);
  assert.equal(exported.target, null);
  assert.deepEqual(await readdir(cwd), []);
});

test("published Candidate lifecycle exports snapshots through MCP without modifying Hub data", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-portability-lifecycle-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const output = path.join(cwd, "export output 中文");
  await mkdir(output);
  await invoke(cwd, "hub_init", { maintainer: "test-maintainer" });
  const candidate = await invoke(cwd, "candidate_create", {
    title: "Portable format",
    summary: "Reusable local formatting.",
  });
  await invoke(cwd, "candidate_evaluate", { id: candidate.id, result: "pass", reviewer: "tester" });
  const body = "# Portable demo\n\nUse [instructions](references/说明.md) to format the supplied text.\n";
  await invoke(cwd, "skill_create", {
    name: "portable-demo",
    description: "Format supplied text using the bundled instructions.",
    content: body,
    candidate_id: candidate.id,
  });
  const draft = await invoke(cwd, "skill_validate", { skill_id: "portable-demo" });
  assert.equal(draft.valid, false);
  assert.ok(draft.errors.some((error) => error.code === "SKILL_NOT_PUBLISHED"));
  const draftExport = await invoke(cwd, "skill_export", {
    skill_id: "portable-demo",
    output_path: output,
    conflict: "overwrite",
  });
  assert.equal(draftExport.exported, false);
  assert.equal(draftExport.target, null);
  assert.deepEqual(await readdir(output), []);
  await assert.rejects(
    invoke(cwd, "skill_publish", { name: "portable-demo", actor: "test-maintainer" }),
    /passing evaluation/,
  );
  await invoke(cwd, "skill_evaluate", { name: "portable-demo", result: "pass" });
  await assert.rejects(invoke(cwd, "skill_publish", { name: "portable-demo", actor: "worker" }), /Maintainer/);
  const published = await invoke(cwd, "skill_publish", { name: "portable-demo", actor: "test-maintainer" });
  assert.equal(published.state, "PUBLISHED");
  assert.equal(published.revision, 1);
  const skillRoot = path.join(cwd, "knowledge", "skills", "portable-demo");
  await mkdir(path.join(skillRoot, "references"));
  const instructions = "Read the input, trim surrounding whitespace, and write the result with a final newline.\n";
  await writeFile(path.join(skillRoot, "references", "说明.md"), instructions);
  const query = await invoke(cwd, "skill_query", { q: "portable-demo", state: "PUBLISHED", limit: 1 });
  assert.equal(query.skills[0].name, "portable-demo");
  const got = await invoke(cwd, "skill_get", { name: "portable-demo" });
  assert.equal(got.content, body);
  const beforeKnowledge = await fileTree(path.join(cwd, "knowledge"));
  const beforeHost = await fileTree(path.join(cwd, "host"));
  const writerLock = path.join(cwd, "knowledge", "indexes", "locks", "skills.lock");
  await writeFile(writerLock, "existing lifecycle writer lock\n");
  const busy = await invoke(cwd, "skill_validate", { skill_id: "portable-demo" });
  assert.equal(busy.valid, false);
  assert.ok(busy.errors.some((error) => error.code === "SOURCE_BUSY"));
  assert.equal(await readFile(writerLock, "utf8"), "existing lifecycle writer lock\n");
  await rm(writerLock);
  const validation = await invoke(cwd, "skill_validate", { skill_id: "portable-demo" });
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(validation.compatibility.agent_skills, true);
  assert.equal(validation.compatibility.independent, true);
  assert.deepEqual(
    validation.files.map((file) => file.path),
    ["SKILL.md", "references/说明.md"],
  );
  const args = { skill_id: "portable-demo", output_path: output };
  const preview = await invoke(cwd, "skill_export", { ...args, dry_run: true });
  assert.equal(preview.exported, false);
  assert.equal(preview.dry_run, true);
  assert.equal(preview.target, path.join(output, "portable-demo"));
  assert.deepEqual(await readdir(output), []);
  const directory = await invoke(cwd, "skill_export", args);
  assert.equal(directory.exported, true);
  assert.equal(directory.format, "directory");
  assert.equal(await readFile(path.join(directory.target, "references", "说明.md"), "utf8"), instructions);
  const exportedMarkdown = await readFile(path.join(directory.target, "SKILL.md"), "utf8");
  assert.match(exportedMarkdown, /^---\nname: portable-demo\n/);
  assert.ok(exportedMarkdown.endsWith(body));
  await assert.rejects(access(path.join(directory.target, "skill.json")));
  for (const file of validation.files) {
    const bytes = await readFile(path.join(directory.target, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256);
  }
  const zip = await invoke(cwd, "skill_export", { ...args, format: "zip" });
  assert.equal(zip.exported, true);
  assert.equal(
    zip.sha256,
    createHash("sha256")
      .update(await readFile(zip.target))
      .digest("hex"),
  );
  await assert.rejects(invoke(cwd, "skill_export", args), /PORTABILITY_CONFLICT/);
  const conflictPreview = await invoke(cwd, "skill_export", { ...args, dry_run: true });
  assert.equal(conflictPreview.conflict, true);
  await invoke(cwd, "skill_export", { ...args, conflict: "overwrite" });
  const repeatZip = await invoke(cwd, "skill_export", { ...args, format: "zip", conflict: "overwrite" });
  assert.equal(repeatZip.sha256, zip.sha256);
  assert.deepEqual(await fileTree(path.join(cwd, "knowledge")), beforeKnowledge);
  assert.deepEqual(await fileTree(path.join(cwd, "host")), beforeHost);
  assert.deepEqual((await readdir(output)).sort(), ["portable-demo", "portable-demo.zip"]);
});

test("legacy Hub validation reports migration without creating folders or rewriting records", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-portability-v1-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const host = path.join(cwd, "host", ".usora");
  await mkdir(host, { recursive: true });
  await writeFile(path.join(host, "config.json"), JSON.stringify({ version: 1, maintainer: "legacy-owner" }));
  const before = await fileTree(cwd);
  const validation = await invoke(cwd, "skill_validate", { skill_id: "legacy-skill" });
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.code === "MIGRATION_REQUIRED"));
  assert.deepEqual(await fileTree(cwd), before);
  assert.deepEqual(await readdir(cwd), ["host"]);
});

test("MCP rejects malformed arguments and unsupported paths without allowing lifecycle privilege bypass", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-portability-args-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  for (const args of [{}, { skill_id: 42 }, { skill_id: "" }, { skill_id: "demo", actor: "maintainer" }]) {
    await assert.rejects(invoke(cwd, "skill_validate", args), /INVALID_ARGUMENT/);
  }
  for (const args of [
    { skill_id: "demo" },
    { skill_id: "demo", output_path: cwd, format: "tar" },
    { skill_id: "demo", output_path: cwd, conflict: "yes" },
    { skill_id: "demo", output_path: cwd, dry_run: "true" },
    { skill_id: "demo", output_path: cwd, actor: "test-maintainer" },
  ]) {
    await assert.rejects(invoke(cwd, "skill_export", args), /INVALID_ARGUMENT/);
  }
  assert.deepEqual(await readdir(cwd), []);
  await publishedSkill(cwd, "# Formatting\n\nTrim surrounding whitespace in the supplied text.\n");
  const absent = await invoke(cwd, "skill_validate", { skill_id: "missing-skill" });
  assert.equal(absent.valid, false);
  assert.ok(absent.errors.some((error) => error.code === "SKILL_NOT_FOUND"));
  const before = await fileTree(path.join(cwd, "knowledge"));
  await assert.rejects(
    invoke(cwd, "skill_export", { skill_id: "portable-demo", output_path: "relative/path" }),
    /PORTABILITY_OUTPUT_PATH/,
  );
  await assert.rejects(
    invoke(cwd, "skill_export", { skill_id: "portable-demo", output_path: path.join(cwd, "knowledge") }),
    /PORTABILITY_OUTPUT_PATH/,
  );
  assert.deepEqual(await fileTree(path.join(cwd, "knowledge")), before);
});

test("missing resources and Foundry runtime requirements are reported honestly by MCP", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "usora-portability-deps-"));
  t.onTestFinished(() => rm(cwd, { recursive: true, force: true }));
  const output = path.join(cwd, "output");
  await mkdir(output);
  await publishedSkill(cwd, "# Broken reference\n\nRead [guide](references/missing.md).\n");
  const missing = await invoke(cwd, "skill_export", { skill_id: "portable-demo", output_path: output });
  assert.equal(missing.exported, false);
  assert.ok(missing.errors.some((error) => error.code === "RESOURCE_NOT_FOUND"));
  assert.deepEqual(await readdir(output), []);
  await publishedSkill(
    cwd,
    "# Hub workflow\n\nUse Usora MCP tool `skill_get` to retrieve the Skill.\n",
    "dependent-demo",
  );
  const dependent = await invoke(cwd, "skill_validate", { skill_id: "dependent-demo" });
  assert.equal(dependent.valid, true);
  assert.equal(dependent.compatibility.independent, false);
  assert.ok(dependent.dependencies.some((dependency) => dependency.kind === "usora_mcp"));
});
