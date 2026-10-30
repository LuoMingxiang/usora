import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, vi } from "vitest";
import { PORTABILITY_LIMITS, validateSkillDirectory } from "../../plugins/foundry/src/core/portability/validate.ts";

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

test("rendering preserves meaningful Markdown body indentation and trailing spaces", async (t) => {
  const body = "    keep the code block indentation  \n";
  for (const header of ["", "---\nname: portable-demo\ndescription: Preserve the supplied format.\n---\n\n"]) {
    const f = await fixture(t, { content: `${header}${body}` });
    const before = await treeHash(f.root);
    const result = await validateSkillDirectory(f.dir, f.name);
    assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
    assert.ok(result.snapshot?.files[0]?.data.toString("utf8").endsWith(body));
    assert.equal(await treeHash(f.root), before);
  }
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
  ["numeric metadata key", '---\nname: portable-demo\ndescription: words\nmetadata:\n  42: "value"\n---\nDo work.\n'],
  [
    "complex metadata key",
    '---\nname: portable-demo\ndescription: words\nmetadata:\n  ? [author, version]\n  : "value"\n---\nDo work.\n',
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

for (const [extension, content] of [
  ["ps1", "Write-Output 'ok'\n"],
  ["cmd", "@echo off\necho ok\n"],
  ["bat", "@echo off\necho ok\n"],
  ["ts", "const answer = 1;\n"],
] as const) {
  test(`reports interpreter or platform dependency for bundled .${extension} scripts without explicit commands`, async (t) => {
    const file = `scripts/run.${extension}`;
    const f = await fixture(t, {
      content: `Execute [the bundled procedure](${file}).\n`,
      files: { [file]: content },
    });
    const result = await validateSkillDirectory(f.dir, f.name);
    assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
    assert.equal(result.report.compatibility.independent, false);
    assert.ok(
      result.report.dependencies.some(
        (dependency) => dependency.required && ["runtime", "platform"].includes(dependency.kind),
      ),
    );
  });
}

test("does not confuse a computed Python token variable with a literal credential", async (t) => {
  const f = await fixture(t, {
    content: "Run [the word normalization script](scripts/normalize.py).\n",
    files: { "scripts/normalize.py": "word = 'Pear'\ntoken = word.lower()\nprint(token)\n" },
  });
  const result = await validateSkillDirectory(f.dir, f.name);
  assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
  assert.equal(result.report.compatibility.independent, false);
  assert.ok(
    result.report.dependencies.some((dependency) => dependency.kind === "runtime" && /python/i.test(dependency.name)),
  );
  assert.ok(!result.report.errors.some((error) => error.code === "SECRET_DETECTED"));
});

for (const [extension, expression, literal] of [
  ["py", "token = word.lower()\nprint(token)\n", 'token = "synthetic-secret-1234"\nprint(token)\n'],
  [
    "js",
    "const token = word.toLowerCase();\nconsole.log(token);\n",
    'const token = "synthetic-secret-1234";\nconsole.log(token);\n',
  ],
  [
    "ts",
    "const token: string = word.toLowerCase();\nconsole.log(token);\n",
    'const token: string = "synthetic-secret-1234";\nconsole.log(token);\n',
  ],
] as const) {
  test(`distinguishes computed .${extension} token expressions from quoted secrets in the same script`, async (t) => {
    const file = `scripts/normalize.${extension}`;
    const f = await fixture(t, {
      content: `Run [the word normalization script](${file}).\n`,
      files: { [file]: expression },
    });
    const computed = await validateSkillDirectory(f.dir, f.name);
    assert.equal(computed.report.valid, true, JSON.stringify(computed.report.errors));
    assert.equal(computed.report.compatibility.independent, false);
    assert.ok(computed.report.dependencies.some((dependency) => dependency.kind === "runtime" && dependency.required));
    await writeFile(path.join(f.dir, file), literal);
    const secret = await validateSkillDirectory(f.dir, f.name);
    assertRejected(secret);
    assert.equal(secret.report.errors[0]?.code, "SECRET_DETECTED");
    assert.ok(!JSON.stringify(secret).includes("synthetic-secret-1234"));
  });
}

for (const [title, afterFence] of [
  ["immediately after a closing code fence", "token: abcdef1234567890\n"],
  ["after a closing code fence, blank lines and prose", "\nText.\n\ntoken: abcdef1234567890\n"],
] as const) {
  test(`rejects and redacts literal secrets ${title}`, async (t) => {
    const f = await fixture(t, {
      content: `\`\`\`python\ntoken = word.lower()\n\`\`\`\n${afterFence}`,
    });
    const result = await validateSkillDirectory(f.dir, f.name);
    assertRejected(result);
    assert.equal(result.report.errors[0]?.code, "SECRET_DETECTED");
    assert.ok(!JSON.stringify(result).includes("abcdef1234567890"));
    assert.deepEqual(result.report.files, []);
    assert.deepEqual(result.report.dependencies, []);
  });
}

for (const [title, pattern] of [
  ["unclosed brackets", "["],
  ["unclosed Markdown links", "[x]("],
  ["blank lines between prose", "\n"],
] as const) {
  test(`validates 900 KiB of ${title} within a bounded analysis time`, async (t) => {
    const malformed = pattern.repeat(Math.floor((900 * 1024) / pattern.length));
    const content = pattern === "\n" ? `Do work.\n${malformed}Return the result.\n` : malformed;
    const f = await fixture(t, { content });
    const started = performance.now();
    const result = await validateSkillDirectory(f.dir, f.name);
    const elapsed = performance.now() - started;
    assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
    assert.ok(elapsed < 2000, `validation exceeded its analysis budget: ${elapsed.toFixed(0)} ms`);
  });
}

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

test("caps filesystem attempts and diagnostics when a Skill declares many distinct missing resources", async (t) => {
  const links = Array.from({ length: 1500 }, (_value, index) => `[${index}](assets/missing-${index}.txt)`);
  const f = await fixture(t, { content: links.join("\n"), files: { "assets/present.txt": "unused\n" } });
  const lstat = vi.spyOn(fs, "lstat");
  try {
    const result = await validateSkillDirectory(f.dir, f.name);
    assertRejected(result);
    const reads = lstat.mock.calls.filter(([file]) => /^missing-\d+\.txt$/.test(path.basename(String(file))));
    assert.ok(reads.length <= PORTABILITY_LIMITS.files, `attempted ${reads.length} missing resource reads`);
    assert.ok(
      result.report.errors.length <= PORTABILITY_LIMITS.files + 1,
      `returned ${result.report.errors.length} diagnostics`,
    );
  } finally {
    lstat.mockRestore();
  }
});

test("attempts a missing resource only once when multiple included documents reference it", async (t) => {
  const f = await fixture(t, {
    content: "Read [first](references/first.md) and [second](references/second.md).\n",
    files: {
      "references/first.md": "Read [missing](references/missing.md).\n",
      "references/second.md": "Read [missing again](references/missing.md).\n",
    },
  });
  const missing = path.join(f.dir, "references", "missing.md");
  const lstat = vi.spyOn(fs, "lstat");
  try {
    assertRejected(await validateSkillDirectory(f.dir, f.name));
    assert.equal(lstat.mock.calls.filter(([file]) => String(file) === missing).length, 1);
  } finally {
    lstat.mockRestore();
  }
});

test("caps dependency analysis and rejects a Skill with many distinct HTTP service hosts", async (t) => {
  const links = Array.from(
    { length: 1500 },
    (_value, index) => `[${index}](https://service-${index}.example.test/guide)`,
  );
  const f = await fixture(t, { content: links.join("\n") });
  const result = await validateSkillDirectory(f.dir, f.name);
  assertRejected(result);
  assert.ok(result.report.errors.some((error) => error.code === "ANALYSIS_LIMIT"));
  for (const entries of [result.report.dependencies, result.report.warnings, result.report.errors]) {
    assert.ok(entries.length <= 100, `returned ${entries.length} analysis entries`);
  }
});

test("caps diagnostics and rejects a Skill with many distinct unsafe references", async (t) => {
  const links = Array.from({ length: 1500 }, (_value, index) => `[${index}](../outside-${index}.txt)`);
  const f = await fixture(t, { content: links.join("\n") });
  const result = await validateSkillDirectory(f.dir, f.name);
  assertRejected(result);
  assert.ok(result.report.errors.some((error) => error.code === "ANALYSIS_LIMIT"));
  for (const entries of [result.report.dependencies, result.report.warnings, result.report.errors]) {
    assert.ok(entries.length <= 100, `returned ${entries.length} analysis entries`);
  }
});

test("deduplicates repeated HTTP references without treating repetition as an analysis overflow", async (t) => {
  const content = Array.from({ length: 1500 }, () => "Read [guide](https://example.test/guide).").join("\n");
  const f = await fixture(t, { content });
  const result = await validateSkillDirectory(f.dir, f.name);
  assert.equal(result.report.valid, true, JSON.stringify(result.report.errors));
  assert.equal(result.report.compatibility.independent, false);
  assert.equal(result.report.dependencies.filter((dependency) => dependency.kind === "external_service").length, 1);
  assert.equal(result.report.warnings.filter((warning) => warning.code === "EXTERNAL_REFERENCE").length, 1);
  assert.ok(!result.report.errors.some((error) => error.code === "ANALYSIS_LIMIT"));
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

test("bounds reads when a resource grows after its initial stat", async (t) => {
  const f = await fixture(t, {
    content: "Read [data](assets/growing.bin).\n",
    files: { "assets/growing.bin": Buffer.from([1, 2, 3]) },
  });
  const growing = path.join(f.dir, "assets", "growing.bin");
  const originalOpen = fs.open.bind(fs);
  let grew = false;
  let unboundedReads = 0;
  let requestedBytes = 0;
  let largestBuffer = 0;
  const open = vi.spyOn(fs, "open").mockImplementation(async (...args: Parameters<typeof fs.open>) => {
    const handle = await originalOpen(...args);
    if (String(args[0]) !== growing) return handle;
    const originalRead = handle.read.bind(handle) as (...readArgs: unknown[]) => Promise<unknown>;
    return {
      stat: async () => {
        const before = await handle.stat();
        if (!grew) {
          grew = true;
          await fs.truncate(growing, PORTABILITY_LIMITS.file_bytes * 2);
        }
        return before;
      },
      read: async (...readArgs: unknown[]) => {
        const first = readArgs[0] as Buffer | { buffer: Buffer; length?: number };
        const buffer = Buffer.isBuffer(first) ? first : first.buffer;
        const length =
          typeof readArgs[2] === "number"
            ? readArgs[2]
            : Buffer.isBuffer(first)
              ? buffer.byteLength
              : (first.length ?? buffer.byteLength);
        largestBuffer = Math.max(largestBuffer, buffer.byteLength);
        requestedBytes += length;
        return originalRead(...readArgs);
      },
      readFile: async () => {
        unboundedReads++;
        throw Error("Unbounded readFile is disabled in the growth fault injection.");
      },
      close: () => handle.close(),
    } as unknown as typeof handle;
  });
  try {
    const result = await validateSkillDirectory(f.dir, f.name);
    assertRejected(result);
    assert.equal(grew, true, "fault injection must run after the initial file stat");
    assert.equal(unboundedReads, 0, "growing input must not use unbounded readFile");
    assert.ok(result.report.errors.some((error) => ["FILE_TOO_LARGE", "SNAPSHOT_CHANGED"].includes(error.code)));
    assert.ok(requestedBytes <= PORTABILITY_LIMITS.file_bytes + 1, `requested ${requestedBytes} bytes`);
    assert.ok(largestBuffer <= PORTABILITY_LIMITS.file_bytes + 1, `allocated buffer of ${largestBuffer} bytes`);
  } finally {
    open.mockRestore();
  }
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

test("keeps quoted and bare JSON, YAML and TOML scalar secrets rejected and redacted", async (t) => {
  for (const [file, content] of [
    ["assets/settings.json", '{"token":"synthetic-secret-1234"}'],
    ["assets/settings.yaml", 'token: "synthetic-secret-1234"\n'],
    ["assets/settings.yaml", "token: synthetic-secret-1234\n"],
    ["assets/settings.toml", 'token = "synthetic-secret-1234"\n'],
  ]) {
    const f = await fixture(t, { content: `Read [settings](${file}).\n`, files: { [file]: content } });
    const result = await validateSkillDirectory(f.dir, f.name);
    assertRejected(result);
    assert.equal(result.report.errors[0]?.code, "SECRET_DETECTED");
    assert.ok(!JSON.stringify(result).includes("synthetic-secret-1234"));
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

test("secret redaction takes priority even after the diagnostic budget is exhausted", async (t) => {
  const secret = `ghp_${"R".repeat(36)}`;
  const files: Record<string, string> = {};
  for (let index = 0; index < 95; index++) files[`references/error-${index}.md`] = "[outside](../outside.md)\n";
  files["references/last.md"] = `See https://${secret}.example.com\n`;
  const content = [
    "---",
    "name: wrong-name",
    'description: ""',
    "custom: value",
    "license: false",
    "allowed-tools: false",
    'compatibility: ""',
    "metadata: {version: 1}",
    "---",
    ...Object.keys(files).map((file) => `[reference](${file})`),
  ].join("\n");
  const f = await fixture(t, { content, files });
  const result = await validateSkillDirectory(f.dir, f.name);
  assertRejected(result);
  assert.ok(result.report.errors.some((error) => error.code === "SECRET_DETECTED"));
  assert.equal(JSON.stringify(result.report).includes(secret), false);
  assert.deepEqual(result.report.files, []);
  assert.deepEqual(result.report.dependencies, []);
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
