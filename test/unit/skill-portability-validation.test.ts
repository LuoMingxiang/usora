import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { validateSkillDirectory } from "../../plugins/foundry/src/core/portability/validate.ts";

type FixtureOptions = {
  name?: string;
  content?: string | Buffer;
  metadata?: Record<string, unknown>;
  files?: Record<string, string | Buffer>;
};

async function fixture(
  t: { onTestFinished: (callback: () => Promise<unknown>) => void },
  options: FixtureOptions = {},
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "usora-portability-validation-"));
  t.onTestFinished(() => rm(root, { recursive: true, force: true }));
  const name = options.name || "portable-demo";
  const dir = path.join(root, name);
  await mkdir(dir);
  const metadata = {
    schema_version: 2,
    name,
    description: "Sort a supplied list of words and return the result.",
    state: "PUBLISHED",
    evaluation: { result: "pass" },
    revision: 1,
    ...options.metadata,
  };
  await writeFile(path.join(dir, "skill.json"), JSON.stringify(metadata));
  await writeFile(
    path.join(dir, "SKILL.md"),
    options.content ?? "# Sort words\n\nSort the supplied words alphabetically.\n",
  );
  for (const [file, data] of Object.entries(options.files || {})) {
    const target = path.join(dir, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
  return { root, dir, name };
}

async function treeHash(dir: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(current: string) {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const file = path.join(current, entry.name);
      hash.update(path.relative(dir, file));
      if (entry.isDirectory()) await walk(file);
      else hash.update(await readFile(file));
    }
  }
  await walk(dir);
  return hash.digest("hex");
}

function assertRejected(result: Awaited<ReturnType<typeof validateSkillDirectory>>) {
  assert.equal(result.report.valid, false);
  assert.equal(result.snapshot, null);
  assert.ok(result.report.errors.length > 0);
  assert.ok(result.report.errors.every((error) => error.code && error.message));
}

test("legacy published Markdown renders standard frontmatter without changing source bytes", async (t) => {
  const f = await fixture(t);
  const before = await treeHash(f.root);
  const result = await validateSkillDirectory(f.dir, f.name);
  assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
  assert.equal(result.report.compatibility.agent_skills, true);
  assert.equal(result.report.compatibility.independent, true);
  assert.deepEqual(result.snapshot?.source, { skill_id: f.name, state: "PUBLISHED", revision: 1 });
  assert.deepEqual(
    result.snapshot?.files.map((file) => file.path),
    ["SKILL.md"],
  );
  const rendered = result.snapshot?.files[0]?.data.toString("utf8") || "";
  assert.match(rendered, /^---\n/);
  assert.match(rendered, /name:.*portable-demo/);
  assert.match(rendered, /description:/);
  assert.match(rendered, /Sort the supplied words alphabetically/);
  assert.equal(result.report.files[0]?.bytes, Buffer.byteLength(rendered));
  assert.equal(result.report.files[0]?.sha256, createHash("sha256").update(rendered).digest("hex"));
  assert.equal(await treeHash(f.root), before);
});

test("existing standard frontmatter supports scalar and string-map optional fields", async (t) => {
  const content = [
    "---",
    "name: portable-demo",
    "description: |",
    "  Sort a supplied list of words.",
    "license: MIT",
    "compatibility: Any host with Markdown instructions.",
    "metadata:",
    '  author: "Example"',
    '  version: "1.0"',
    'allowed-tools: "Read"',
    "---",
    "# Procedure",
    "Return supplied words in ascending order.",
    "",
  ].join("\n");
  const f = await fixture(t, { content });
  const result = await validateSkillDirectory(f.dir, f.name);
  assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
  assert.match(result.snapshot?.files[0]?.data.toString("utf8") || "", /metadata:/);
  assert.ok(result.report.warnings.length > 0, "experimental allowed-tools support must be qualified");
});

for (const [title, content] of [
  ["malformed YAML", "---\nname: [unterminated\ndescription: words\n---\nDo work.\n"],
  ["duplicate YAML key", "---\nname: portable-demo\nname: alternate\ndescription: words\n---\nDo work.\n"],
  ["YAML alias", "---\nname: &n portable-demo\ndescription: *n\n---\nDo work.\n"],
  ["custom YAML tag", "---\nname: !custom portable-demo\ndescription: words\n---\nDo work.\n"],
  ["missing frontmatter delimiter", "---\nname: portable-demo\ndescription: words\nDo work.\n"],
  ["frontmatter name mismatch", "---\nname: another-skill\ndescription: words\n---\nDo work.\n"],
  ["nonstring description", "---\nname: portable-demo\ndescription: 42\n---\nDo work.\n"],
  [
    "nonstring metadata value",
    "---\nname: portable-demo\ndescription: words\nmetadata:\n  version: 1\n---\nDo work.\n",
  ],
  ["empty body", "---\nname: portable-demo\ndescription: words\n---\n\n"],
] as const) {
  test(`rejects ${title} without silently repairing authored frontmatter`, async (t) => {
    const f = await fixture(t, { content });
    assertRejected(await validateSkillDirectory(f.dir, f.name));
  });
}

for (const name of ["Uppercase", "trailing-", "double--hyphen"]) {
  test(`preserves legacy storage but rejects nonportable Skill name ${name}`, async (t) => {
    const f = await fixture(t, { name });
    assertRejected(await validateSkillDirectory(f.dir, f.name));
  });
}

test("rejects empty or oversized descriptions and optional compatibility", async (t) => {
  const empty = await fixture(t, { metadata: { description: " " } });
  assertRejected(await validateSkillDirectory(empty.dir, empty.name));
  const long = await fixture(t, { metadata: { description: "x".repeat(1025) } });
  assertRejected(await validateSkillDirectory(long.dir, long.name));
  const compat = await fixture(t, {
    content: `---\nname: portable-demo\ndescription: words\ncompatibility: ${"x".repeat(501)}\n---\nDo work.\n`,
  });
  assertRejected(await validateSkillDirectory(compat.dir, compat.name));
});

test("rejects nonpublished or unapproved records", async (t) => {
  for (const metadata of [{ state: "DRAFT" }, { state: "RETIRED" }, { evaluation: { result: "fail" } }]) {
    const f = await fixture(t, { metadata });
    assertRejected(await validateSkillDirectory(f.dir, f.name));
  }
});

test("requires actual metadata and Markdown files instead of a JSON content fallback", async (t) => {
  const f = await fixture(t, { metadata: { content: "# JSON fallback" } });
  await rm(path.join(f.dir, "SKILL.md"));
  assertRejected(await validateSkillDirectory(f.dir, f.name));
  await writeFile(path.join(f.dir, "SKILL.md"), "Do work.\n");
  await writeFile(path.join(f.dir, "skill.json"), "{broken");
  assertRejected(await validateSkillDirectory(f.dir, f.name));
});

test("rejects mismatching metadata identity instead of exporting a different Skill under selected name", async (t) => {
  const f = await fixture(t, { metadata: { name: "another-skill" } });
  assertRejected(await validateSkillDirectory(f.dir, f.name));
});

test("collects referenced resource closure, supports Unicode/spaces, and omits unrelated Hub files", async (t) => {
  const f = await fixture(t, {
    content: "# Steps\nRead [guide](references/guide.md) and [sample](<assets/中文 sample.txt>).\n",
    files: {
      "references/guide.md": "Use [details](references/details.md).\n",
      "references/details.md": "Return sorted words.\n",
      "assets/中文 sample.txt": "pear\napple\n",
      "assets/unreferenced.txt": "do not package",
      "usage.json": "private runtime information",
    },
  });
  const result = await validateSkillDirectory(f.dir, f.name);
  assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
  assert.deepEqual(
    result.snapshot?.files.map((file) => file.path).sort(),
    ["SKILL.md", "assets/中文 sample.txt", "references/details.md", "references/guide.md"].sort(),
  );
  assert.equal(
    result.snapshot?.files.find((file) => file.path.endsWith("sample.txt"))?.data.toString(),
    "pear\napple\n",
  );
});

test("script paths in commands are collected and interpreter dependency is reported", async (t) => {
  const f = await fixture(t, {
    content: "# Steps\nRun `python scripts/run.py`.\n",
    files: { "scripts/run.py": "print('sorted')\n" },
  });
  const result = await validateSkillDirectory(f.dir, f.name);
  assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
  assert.ok(result.snapshot?.files.some((file) => file.path === "scripts/run.py"));
  assert.ok(result.report.dependencies.some((dep) => /python|runtime/i.test(`${dep.name} ${dep.kind}`)));
  assert.equal(result.report.compatibility.independent, false);
});

test("deduplicates repeated references to the same resource", async (t) => {
  const f = await fixture(t, {
    content: "Read [first](references/guide.md), then [again](references/guide.md).\n",
    files: { "references/guide.md": "Return sorted words.\n" },
  });
  const result = await validateSkillDirectory(f.dir, f.name);
  assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
  assert.deepEqual(result.snapshot?.files.map((file) => file.path).sort(), ["SKILL.md", "references/guide.md"]);
});

test("resolves Markdown reference definitions and document fragments without packaging duplicates", async (t) => {
  const f = await fixture(t, {
    content: "Read [the guide][guide] or [the steps](references/guide.md#steps).\n\n[guide]: references/guide.md\n",
    files: { "references/guide.md": "# Steps\nReturn sorted words.\n" },
  });
  const result = await validateSkillDirectory(f.dir, f.name);
  assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
  assert.deepEqual(result.snapshot?.files.map((file) => file.path).sort(), ["SKILL.md", "references/guide.md"]);
});

test("rejects referenced sensitive config filenames even when their values are placeholders", async (t) => {
  for (const name of [".env", ".npmrc", ".pypirc", ".netrc"]) {
    const f = await fixture(t, {
      content: `Use [settings](assets/${name}).\n`,
      files: { [`assets/${name}`]: "API_TOKEN=REPLACE_ME\n" },
    });
    assertRejected(await validateSkillDirectory(f.dir, f.name));
  }
});

test("missing and cyclic references produce actionable diagnostics", async (t) => {
  const missing = await fixture(t, { content: "See [missing](references/missing.md).\n" });
  assertRejected(await validateSkillDirectory(missing.dir, missing.name));
  const cycle = await fixture(t, {
    content: "See [a](references/a.md).\n",
    files: {
      "references/a.md": "See [b](references/b.md).\n",
      "references/b.md": "See [a](references/a.md).\n",
    },
  });
  const result = await validateSkillDirectory(cycle.dir, cycle.name);
  assert.ok([...result.report.errors, ...result.report.warnings].some((d) => /cycl/i.test(`${d.code} ${d.message}`)));
  assert.ok(result.report.files.length <= 3, "cycle must not duplicate resource entries");
});

for (const target of [
  "../outside.txt",
  "references/../../outside.txt",
  "references/%2e%2e/%2e%2e/outside.txt",
  "references\\outside.txt",
  "C:/private/token.txt",
  "//server/share/file.txt",
  "/etc/passwd",
  "skill.json",
  "assets/CON.txt",
]) {
  test(`rejects unsafe or nonwhitelisted resource reference ${target}`, async (t) => {
    const f = await fixture(t, { content: `Read [resource](${target}).\n` });
    assertRejected(await validateSkillDirectory(f.dir, f.name));
  });
}

test("rejects symlink resources, symlinked resource parents and symlinked source directories", async (t) => {
  const f = await fixture(t, { content: "Read [guide](references/guide.md).\n" });
  const external = path.join(f.root, "external");
  await mkdir(external);
  await writeFile(path.join(external, "guide.md"), "Outside source.\n");
  await symlink(external, path.join(f.dir, "references"), "dir");
  assertRejected(await validateSkillDirectory(f.dir, f.name));
  await rm(path.join(f.dir, "references"));
  await mkdir(path.join(f.dir, "references"));
  await symlink(path.join(external, "guide.md"), path.join(f.dir, "references", "guide.md"));
  assertRejected(await validateSkillDirectory(f.dir, f.name));
  const alias = path.join(f.root, "source-link");
  await symlink(f.dir, alias, "dir");
  assertRejected(await validateSkillDirectory(alias, f.name));
});

test("rejects malformed UTF-8 Markdown and bounded file sizes", async (t) => {
  const malformed = await fixture(t, { content: Buffer.from([0xff, 0xfe, 0x61]) });
  assertRejected(await validateSkillDirectory(malformed.dir, malformed.name));
  const oversized = await fixture(t, {
    content: "Read [large](assets/large.txt).\n",
    files: { "assets/large.txt": Buffer.alloc(1024 * 1024 + 1, 0x61) },
  });
  assertRejected(await validateSkillDirectory(oversized.dir, oversized.name));
});

test("enforces resource count bound before allocating a complete oversized package", async (t) => {
  const files: Record<string, string> = {};
  const links: string[] = [];
  for (let i = 0; i < 101; i++) {
    const name = `assets/file-${i}.txt`;
    files[name] = "word\n";
    links.push(`[${i}](${name})`);
  }
  const f = await fixture(t, { content: links.join("\n"), files });
  assertRejected(await validateSkillDirectory(f.dir, f.name));
});

test("enforces total byte limit even when every included file meets the per-file limit", async (t) => {
  const files: Record<string, Buffer> = {};
  const links: string[] = [];
  for (let i = 0; i < 17; i++) {
    const name = `assets/chunk-${i}.bin`;
    files[name] = Buffer.alloc(1024 * 1024, 0);
    links.push(`[${i}](${name})`);
  }
  const f = await fixture(t, { content: links.join("\n"), files });
  assertRejected(await validateSkillDirectory(f.dir, f.name));
});

for (const [title, content] of [
  ["private key", "-----BEGIN PRIVATE KEY-----\nsynthetic-example-only\n-----END PRIVATE KEY-----"],
  ["GitHub token", `ghp_${"x".repeat(36)}`],
  ["literal API key assignment", 'API_KEY="literal-example-credential-1234567890"'],
] as const) {
  test(`rejects ${title} in included content without echoing credential text in diagnostics`, async (t) => {
    const f = await fixture(t, { content: `# Procedure\n${content}\n` });
    const result = await validateSkillDirectory(f.dir, f.name);
    assertRejected(result);
    assert.ok(!JSON.stringify(result.report.errors).includes(content));
  });
}

test("scans included binary assets for embedded secret markers", async (t) => {
  const f = await fixture(t, {
    content: "See [image](assets/example.png).\n",
    files: {
      "assets/example.png": Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]),
        Buffer.from("-----BEGIN RSA PRIVATE KEY-----"),
      ]),
    },
  });
  assertRejected(await validateSkillDirectory(f.dir, f.name));
});

test("rejects quoted JSON, YAML and TOML credentials including punctuation", async (t) => {
  for (const content of [
    '{"api_key":"synthetic-review-credential-123456","password":"synthetic-password-123456"}',
    '"password": "p@$$!word"',
    "'client_secret' = 'abc!@#$%'",
  ]) {
    const f = await fixture(t, {
      content: "Read [settings](assets/settings.json).\n",
      files: { "assets/settings.json": content },
    });
    const result = await validateSkillDirectory(f.dir, f.name);
    assertRejected(result);
    assert.equal(result.report.errors[0]?.code, "SECRET_DETECTED");
    assert.ok(!JSON.stringify(result.report).includes(content));
  }
});

test("redacts every source-derived report field when tokens occur in keys, URLs or filenames", async (t) => {
  const token = `ghp_${"x".repeat(36)}`;
  for (const content of [
    `---\nname: portable-demo\ndescription: words\n${token}: value\n---\nDo work.\n`,
    `Read https://${token}.example.com/guide.\n`,
    `Read [guide](assets/${token}.txt).\n`,
  ]) {
    const f = await fixture(t, { content });
    const result = await validateSkillDirectory(f.dir, f.name);
    assertRejected(result);
    assert.equal(result.report.errors[0]?.code, "SECRET_DETECTED");
    assert.ok(!JSON.stringify(result).includes(token));
    assert.deepEqual(result.report.files, []);
    assert.deepEqual(result.report.dependencies, []);
  }
});

test("does not misreport Usora MCP, external services or credential requirements as independently executable", async (t) => {
  for (const content of [
    "Call Usora MCP `activity_capture` with the current task.\n",
    "Use the MCP server to call `hub_status`.\n",
    "Call `skill_get` to load the selected instructions.\n",
    "Fetch https://api.example.com/words using API_TOKEN from the environment.\n",
    "Read API_TOKEN from the environment before processing the word list.\n",
    "Read $TOKEN before processing the word list.\n",
    "Run PowerShell Get-Content to read the word list.\n",
  ]) {
    const f = await fixture(t, { content });
    const result = await validateSkillDirectory(f.dir, f.name);
    assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
    assert.equal(result.report.compatibility.independent, false);
    assert.ok(result.report.dependencies.length > 0);
    assert.ok(result.report.compatibility.notes.length > 0);
  }
});
