import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPortabilityProcess, type PortabilityProcessResult } from "./lib/skill-portability-process.ts";

type JsonRecord = Record<string, unknown>;
type RpcResponse = {
  id?: number;
  result?: { content: { text: string }[] };
  error?: { message: string };
};

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = path.join(repository, "docs/examples/skill-portability/fixture");
const skillId = "portable-release-notes";
const args = process.argv.slice(2);
let requestedOutput = "artifacts/skill-portability";
let withHost = false;
let hostTimeout = 60_000;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--host") withHost = true;
  else if (args[index] === "--output") {
    const value = args[++index];
    if (!value || value.startsWith("--")) throw Error("--output requires a directory");
    requestedOutput = value;
  } else if (args[index] === "--host-timeout-ms") {
    hostTimeout = Number(args[++index]);
    if (!Number.isInteger(hostTimeout) || hostTimeout < 1000 || hostTimeout > 600_000) {
      throw Error("--host-timeout-ms must be an integer from 1000 to 600000");
    }
  } else
    throw Error("Usage: bun scripts/skill-portability-demo.ts [--output directory] [--host] [--host-timeout-ms 60000]");
}
const outputRoot = path.resolve(requestedOutput);

function run(
  command: string,
  commandArgs: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  input = "",
  timeout = 30_000,
): Promise<PortabilityProcessResult> {
  return runPortabilityProcess(command, commandArgs, { cwd, env, input, timeoutMs: timeout });
}

async function treeDigest(root: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(current: string): Promise<void> {
    const entries = (await readdir(current, { withFileTypes: true })).sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(root, absolute).replaceAll("\\", "/");
      hash.update(`${entry.isDirectory() ? "directory" : "file"}:${relative}\0`);
      if (entry.isDirectory()) await walk(absolute);
      else hash.update(await readFile(absolute));
    }
  }
  await walk(root);
  return hash.digest("hex");
}

function safeDiagnostic(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:sk-|gh[pousr]_)[A-Za-z0-9_-]{12,}/g, "[redacted]")
    .slice(-2000);
}

async function inspectCodexSkill(project: string, env: NodeJS.ProcessEnv): Promise<JsonRecord> {
  let pending = "";
  let report: JsonRecord | undefined;
  // app-server does not expose exec's --ignore-user-config flag. No thread,
  // model request, or MCP tool call is created: only local skills/list metadata.
  const result = await runPortabilityProcess("codex", ["app-server", "--stdio"], {
    cwd: project,
    env,
    timeoutMs: 15_000,
    keepStdinOpen: true,
    input: `${JSON.stringify({ id: 1, method: "initialize", params: { clientInfo: { name: "usora-portability-acceptance", version: "1" }, capabilities: { experimentalApi: false, requestAttestation: false } } })}\n`,
    onStdout(chunk, { write, stop }) {
      pending += chunk;
      let newline = pending.indexOf("\n");
      while (newline >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        newline = pending.indexOf("\n");
        if (!line.trim()) continue;
        const response = JSON.parse(line) as { id?: number; error?: { message: string }; result?: JsonRecord };
        if (response.error) throw Error(`Codex app-server: ${response.error.message}`);
        if (response.id === 1) {
          write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
          write(
            `${JSON.stringify({ id: 2, method: "skills/list", params: { cwds: [project], forceReload: true } })}\n`,
          );
        } else if (response.id === 2) {
          const entries = response.result?.data;
          assert.ok(Array.isArray(entries), "Codex skills/list returned no data");
          const entry = entries.find((item: JsonRecord) => item.cwd === project) as JsonRecord | undefined;
          assert.ok(entry && Array.isArray(entry.skills), "Codex did not inspect the isolated project");
          const selected = entry.skills.find((item: JsonRecord) => item.name === skillId) as JsonRecord | undefined;
          assert.ok(selected, "Codex did not discover the exported Skill");
          assert.equal(selected.enabled, true, "Exported Skill is disabled in Codex");
          assert.equal(selected.pluginId, null, "Exported Skill unexpectedly requires a plugin");
          assert.equal(
            path.resolve(String(selected.path)),
            path.join(project, ".agents", "skills", skillId, "SKILL.md"),
          );
          const errors = Array.isArray(entry.errors) ? entry.errors : [];
          assert.equal(errors.length, 0, "Codex reported Skill parsing errors");
          report = {
            status: "passed",
            method: "Codex app-server skills/list",
            name: selected.name,
            description: selected.description,
            path: `.agents/skills/${skillId}/SKILL.md`,
            scope: selected.scope,
            enabled: selected.enabled,
            plugin_id: selected.pluginId,
            errors: [],
            model_requests: 0,
            mcp_tool_calls: 0,
            note: "Actual local Codex loader recognition; this does not prove model task execution. App-server uses installed configuration; it has no --ignore-user-config flag.",
          };
          stop();
          return;
        }
      }
    },
  });
  assert.equal(result.outputLimitExceeded, false, "Codex local skills/list exceeded the acceptance output limit");
  assert.equal(result.timedOut, false, "Codex local skills/list timed out after 15 seconds");
  assert.ok(report, "Codex app-server closed before skills/list completed");
  return report;
}

const input = {
  changes: [
    { id: "C-03", type: "fix", summary: "Preserve resource bytes in exported archives." },
    { id: "C-02", type: "feat", summary: "Export a published Skill as a directory." },
    { id: "C-04", type: "docs", summary: "Document the independent acceptance flow." },
    { id: "C-01", type: "feat", summary: "Validate Skill metadata before export." },
  ],
};
const expected = {
  format: "portable-release-notes-v1",
  added: [
    { id: "C-01", summary: "Validate Skill metadata before export." },
    { id: "C-02", summary: "Export a published Skill as a directory." },
  ],
  fixed: [{ id: "C-03", summary: "Preserve resource bytes in exported archives." }],
  documentation: [{ id: "C-04", summary: "Document the independent acceptance flow." }],
};

const unzipVerifier = String.raw`
import hashlib, json, pathlib, sys, zipfile
archive, directory, extracted, skill = sys.argv[1:]
destination = pathlib.Path(extracted)
files = []
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None, "ZIP CRC verification failed"
    names = package.namelist()
    assert names and len(names) == len(set(names)), "Empty or duplicate ZIP entries"
    for entry in package.infolist():
        name = entry.filename
        relative = pathlib.PurePosixPath(name)
        assert not relative.is_absolute() and ".." not in relative.parts and "\\" not in name
        assert relative.parts[0] == skill and len(relative.parts) > 1, "Unexpected ZIP root"
        assert not entry.is_dir(), "Empty directories must not be packaged"
        assert entry.flag_bits & 0x800, "ZIP filename UTF-8 bit missing"
        content = package.read(entry)
        source = pathlib.Path(directory).joinpath(*relative.parts)
        assert source.read_bytes() == content, "Directory/ZIP byte mismatch: " + name
        target = destination.joinpath(*relative.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        files.append({"path": name, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
assert any(item["path"] == skill + "/SKILL.md" for item in files)
print(json.dumps({"reader": "Python stdlib zipfile", "files": files, "crc": "passed", "directory_bytes": "identical", "paths": "safe"}))
`;

await mkdir(outputRoot, { recursive: true });
const output = await mkdtemp(path.join(outputRoot, "run-"));
const scratch = await mkdtemp(path.join(os.tmpdir(), "usora-portability-demo-"));
const hub = path.join(scratch, "hub");
const hostData = path.join(scratch, "host-data");
const project = path.join(scratch, "independent-project");
// The exporter deliberately refuses repository/install paths. Export externally,
// verify the bytes, then copy the reviewable demo artifacts into the requested output.
const directoryRoot = path.join(scratch, "exports", "directory");
const zipRoot = path.join(scratch, "exports", "zip");
const extractedRoot = path.join(output, "unpacked");
await Promise.all([mkdir(directoryRoot, { recursive: true }), mkdir(zipRoot, { recursive: true }), mkdir(project)]);

// Both knowledge and host-local data are explicitly sandboxed in the temporary demo tree.
const mcpEnv = {
  ...process.env,
  USORA_HOME: hub,
  PLUGIN_DATA: hostData,
  CODEBUDDY_PLUGIN_DATA: "",
  CODEBUDDY_PLUGIN_ROOT: "",
  CLAUDE_PLUGIN_ROOT: "",
};
const calls: { name: string; arguments: JsonRecord; result: unknown }[] = [];
async function call(name: string, toolArgs: JsonRecord = {}): Promise<JsonRecord> {
  const request = { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: toolArgs } };
  const result = await run(
    "node",
    [path.join(repository, "plugins/foundry/dist/mcp.js")],
    scratch,
    mcpEnv,
    `${JSON.stringify(request)}\n`,
  );
  assert.equal(result.code, 0, `MCP process failed: ${safeDiagnostic(result.stderr)}`);
  const response = JSON.parse(result.stdout.trim()) as RpcResponse;
  if (response.error) throw Error(`${name}: ${response.error.message}`);
  assert.ok(response.result?.content[0]?.text, `${name}: missing MCP result`);
  const payload = JSON.parse(response.result.content[0].text) as JsonRecord;
  calls.push({ name, arguments: toolArgs, result: payload });
  return payload;
}

const summary: JsonRecord = {
  skill_id: skillId,
  fixture: "docs/examples/skill-portability/fixture",
  output,
  node: (await run("node", ["--version"], scratch, process.env)).stdout.trim(),
  lifecycle: "pending",
  exports: "pending",
  independent_host: { status: "not_run", reason: "Pass --host to execute the real installed Codex host." },
};
try {
  const content = await readFile(path.join(fixture, "SKILL.md"), "utf8");
  const guide = await readFile(path.join(fixture, "references", "style-guide.md"), "utf8");
  assert.match(content, /references\/style-guide\.md/);
  assert.match(guide, /portable-release-notes-v1/);
  await call("hub_init", { maintainer: "codex", automation_policy: "manual_approval" });
  const activity1 = await call("activity_capture", {
    session_id: "portability-demo-first",
    task: "Read the explicit portability acceptance fixture",
    result: "Loaded the local Skill instructions and verified the bundled guide reference",
    key_points: ["Fixture describes grouping changes by type and sorting by ID"],
  });
  const activity2 = await call("activity_capture", {
    session_id: "portability-demo-second",
    task: "Read the acceptance fixture output contract",
    result: "Loaded the local reference and verified its release-notes format identifier",
    key_points: ["Contract requires preserving change summaries verbatim"],
  });
  const candidate = await call("candidate_create", {
    title: "Portable release notes",
    summary: "Group local changes into repeatable release notes without external services",
    evidence: [activity1.id, activity2.id],
    occurrences: 2,
    source: "explicit_portability_acceptance_demo",
  });
  const evaluatedCandidate = await call("candidate_evaluate", { id: candidate.id, result: "pass", reviewer: "codex" });
  assert.equal(evaluatedCandidate.state, "EVALUATED");
  const draft = await call("skill_create", {
    name: skillId,
    candidate_id: candidate.id,
    description: "Create consistent release notes from local categorized changes.",
    content,
  });
  assert.equal(draft.state, "DRAFT");
  // Current Skill creation accepts Markdown; the fixture's explicitly referenced resource is attached locally.
  await cp(path.join(fixture, "references"), path.join(hub, "skills", skillId, "references"), { recursive: true });
  await call("skill_evaluate", {
    name: skillId,
    result: "pass",
    reviewer: "codex",
    notes: "Self-contained instruction and reference fixture reviewed for the acceptance demo.",
  });
  const published = await call("skill_publish", { name: skillId, actor: "codex" });
  assert.equal(published.state, "PUBLISHED");
  await call("skill_query", { q: skillId, state: "PUBLISHED", limit: 1 });
  const selected = await call("skill_get", { name: skillId });
  assert.equal((selected.metadata as JsonRecord).state, "PUBLISHED");
  summary.lifecycle = "Activity → Candidate → Draft → Evaluate → Publish completed through built MCP";

  const sourceDigest = async () =>
    createHash("sha256")
      .update(await treeDigest(hub))
      .update(await treeDigest(hostData))
      .digest("hex");
  const before = await sourceDigest();
  const validation = await call("skill_validate", { skill_id: skillId });
  assert.equal(validation.valid, true, JSON.stringify(validation));
  assert.equal(
    (validation.compatibility as JsonRecord).independent,
    true,
    "Instruction-only fixture must be independently eligible",
  );
  const preview = await call("skill_export", {
    skill_id: skillId,
    format: "directory",
    output_path: directoryRoot,
    dry_run: true,
  });
  assert.equal(preview.dry_run, true);
  const directory = await call("skill_export", { skill_id: skillId, format: "directory", output_path: directoryRoot });
  const zip = await call("skill_export", { skill_id: skillId, format: "zip", output_path: zipRoot });
  assert.equal(directory.exported, true);
  assert.equal(zip.exported, true);
  const repeatedRoot = path.join(scratch, "exports", "repeat");
  await mkdir(repeatedRoot);
  const repeated = await call("skill_export", { skill_id: skillId, format: "zip", output_path: repeatedRoot });
  const archive = path.join(zipRoot, `${skillId}.zip`);
  assert.deepEqual(
    await readFile(archive),
    await readFile(path.join(repeatedRoot, `${skillId}.zip`)),
    "Repeated ZIP exports must be deterministic",
  );
  assert.equal(repeated.exported, true);
  const after = await sourceDigest();
  assert.equal(after, before, "Validation/export changed source Hub or host data");
  const unzip = await run(
    "python3",
    ["-c", unzipVerifier, archive, directoryRoot, extractedRoot, skillId],
    output,
    process.env,
  );
  assert.equal(unzip.code, 0, `Independent ZIP validation failed: ${safeDiagnostic(unzip.stderr)}`);
  await cp(directoryRoot, path.join(output, "directory"), { recursive: true });
  await cp(zipRoot, path.join(output, "zip"), { recursive: true });
  summary.exports = {
    status: "passed",
    validation,
    directory: path.join(output, "directory", skillId),
    zip: path.join(output, "zip", `${skillId}.zip`),
    zip_sha256: createHash("sha256")
      .update(await readFile(archive))
      .digest("hex"),
    repeated_zip: "identical",
    source_digest_before: before,
    source_digest_after: after,
    independent_zip_reader: JSON.parse(unzip.stdout),
  };

  if (withHost) {
    const skillsRoot = path.join(project, ".agents", "skills");
    await mkdir(skillsRoot, { recursive: true });
    await cp(path.join(extractedRoot, skillId), path.join(skillsRoot, skillId), { recursive: true });
    await writeFile(path.join(project, "changes.json"), `${JSON.stringify(input, null, 2)}\n`);
    const hostEnv = { ...process.env };
    for (const key of [
      "USORA_HOME",
      "PLUGIN_DATA",
      "CODEBUDDY_PLUGIN_DATA",
      "CODEBUDDY_PLUGIN_ROOT",
      "CLAUDE_PLUGIN_ROOT",
    ])
      delete hostEnv[key];
    const version = await run("codex", ["--version"], project, hostEnv);
    assert.equal(version.code, 0, "Codex host version unavailable");
    assert.equal((await readdir(project)).includes(".usora"), false, "Independent project contains a Hub");
    summary.independent_loader = { ...(await inspectCodexSkill(project, hostEnv)), host: version.stdout.trim() };
    const prompt = `Use $${skillId} to process the local changes.json and create the required output. Read its bundled reference. Complete the task and verify the output. Do not use any MCP tools, network services, plugins, or Usora. Only the local Skill and project files are needed.`;
    const host = await run(
      "codex",
      [
        "-a",
        "never",
        "exec",
        "--ignore-user-config",
        "--ephemeral",
        "--skip-git-repo-check",
        "--json",
        "--sandbox",
        "workspace-write",
        "-C",
        project,
        prompt,
      ],
      project,
      hostEnv,
      "",
      hostTimeout,
    );
    const events = host.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as JsonRecord;
        } catch {
          return { type: "unparsed" };
        }
      });
    const mcpEvents = events.filter((event) => JSON.stringify(event).includes('"mcp_tool_call"'));
    const skillRead = events.some(
      (event) => JSON.stringify(event).includes("SKILL.md") || JSON.stringify(event).includes("style-guide.md"),
    );
    const diagnostic = safeDiagnostic(
      `${host.stderr}\n${events
        .filter((event) => event.type === "error")
        .map((event) => event.message)
        .join("\n")}`,
    );
    const blocked = /403|Proxy connection failed|waiting for network|error sending request/i.test(diagnostic);
    summary.independent_host = {
      status: blocked ? "blocked" : "failed",
      host: version.stdout.trim(),
      exit_code: host.code,
      mcp_calls: mcpEvents.length,
      skill_read_observed: skillRead,
      diagnostic,
      timeout_ms: hostTimeout,
      timed_out: host.timedOut,
      output_limit_exceeded: host.outputLimitExceeded,
      isolation: "Temporary project; exported ZIP Skill only; no Hub; user config ignored; no MCP calls permitted",
    };
    assert.equal(host.code, 0, `Codex task failed: ${safeDiagnostic(host.stderr)}`);
    assert.equal(mcpEvents.length, 0, "Independent host invoked MCP");
    assert.equal(skillRead, true, "Host did not show loading Skill instructions or reference");
    const actual = JSON.parse(await readFile(path.join(project, "release-notes.json"), "utf8")) as unknown;
    assert.deepEqual(actual, expected, "Independent host task output did not match the Skill contract");
    const hostOutput = path.join(output, "host-output");
    await mkdir(hostOutput);
    await writeFile(path.join(hostOutput, "changes.json"), `${JSON.stringify(input, null, 2)}\n`);
    await writeFile(path.join(hostOutput, "release-notes.json"), `${JSON.stringify(actual, null, 2)}\n`);
    summary.independent_host = {
      status: "passed",
      host: version.stdout.trim(),
      exit_code: host.code,
      mcp_calls: 0,
      skill_read_observed: true,
      task_output: "host-output/release-notes.json",
      verified: "Exact four-key output, classification, ordering and summaries match expected data",
      isolation: "Temporary project; exported ZIP Skill only; no Hub; user config ignored; no MCP calls",
    };
  }
  summary.status = "passed";
} catch (error) {
  summary.status = "failed";
  summary.error = safeDiagnostic(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await writeFile(path.join(output, "evidence.json"), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(output, "mcp-calls.json"), `${JSON.stringify(calls, null, 2)}\n`);
  await rm(scratch, { recursive: true, force: true });
  console.log(JSON.stringify(summary, null, 2));
}
