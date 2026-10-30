import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";
import { test } from "vitest";
import { runPortabilityProcess } from "../../scripts/lib/skill-portability-process.ts";

type TestContext = { onTestFinished: (callback: () => void) => void };

function processFixture(t: TestContext) {
  const pids = new Set<number>();
  let pending = "";
  const cleanup = () => {
    for (const pid of pids) {
      if (process.platform !== "win32") {
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          /* The owned process group may already be gone. */
        }
      }
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* The process may already be reaped. */
      }
    }
  };
  t.onTestFinished(cleanup);
  return {
    pids,
    observe(text: string) {
      pending += text;
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) {
        const match = /^PID:(\d+)$/.exec(line);
        if (match) pids.add(Number(match[1]));
      }
    },
    async bounded<T>(work: Promise<T>): Promise<T> {
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            watchdog = setTimeout(() => {
              cleanup();
              reject(Error("Acceptance subprocess exceeded independent 4-second watchdog"));
            }, 4000);
          }),
        ]);
      } finally {
        clearTimeout(watchdog);
      }
    },
  };
}

async function running(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  if (process.platform === "linux") {
    // Container init may briefly retain a dead orphan as a zombie. It has no
    // runnable process or held streams and cannot be reaped by this test.
    try {
      const status = await readFile(`/proc/${pid}/stat`, "utf8");
      return status.slice(status.lastIndexOf(")") + 2).split(" ")[0] !== "Z";
    } catch {
      return false;
    }
  }
  return true;
}

async function assertChildrenGone(pids: Set<number>): Promise<void> {
  assert.ok(pids.size > 0, "Fixture must report its actual process IDs");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if ((await Promise.all([...pids].map(running))).every((value) => !value)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.deepEqual(
    await Promise.all([...pids].map(running)),
    [...pids].map(() => false),
  );
}

const options = { cwd: os.tmpdir(), env: process.env };

test("acceptance runner preserves stdin, cwd, environment, output, and ordinary exit status", async () => {
  const result = await runPortabilityProcess(
    "node",
    [
      "-e",
      [
        "let input = ''; process.stdin.setEncoding('utf8');",
        "process.stdin.on('data', chunk => input += chunk);",
        "process.stdin.on('end', () => {",
        "process.stdout.write(JSON.stringify({ input, cwd: process.cwd(), marker: process.env.PORTABILITY_PROCESS_TEST }));",
        "process.stderr.write('ordinary diagnostic'); process.exitCode = 7; });",
      ].join("\n"),
    ],
    {
      ...options,
      env: { ...process.env, PORTABILITY_PROCESS_TEST: "local-fixture" },
      input: "中文 input\n",
    },
  );
  assert.equal(result.code, 7);
  assert.deepEqual(JSON.parse(result.stdout), { input: "中文 input\n", cwd: os.tmpdir(), marker: "local-fixture" });
  assert.equal(result.stderr, "ordinary diagnostic");
  assert.equal(result.timedOut, false);
  assert.equal(result.outputLimitExceeded, false);
});

test("acceptance runner rejects an unavailable executable without leaving pending timers", async () => {
  await assert.rejects(
    runPortabilityProcess(`usora-portability-missing-command-${process.pid}`, [], { ...options, timeoutMs: 500 }),
    /ENOENT/,
  );
});

test.skipIf(process.platform === "win32")(
  "acceptance timeout escalates when a real child ignores SIGTERM",
  async (t) => {
    const fixture = processFixture(t);
    const started = Date.now();
    const result = await fixture.bounded(
      runPortabilityProcess(
        "node",
        [
          "-e",
          [
            "process.on('SIGTERM', () => process.stdout.write('TERM ignored\\n'));",
            "process.stdout.write('PID:' + process.pid + '\\n');",
            "setInterval(() => {}, 1000);",
          ].join("\n"),
        ],
        { ...options, timeoutMs: 400, killGraceMs: 75, onStdout: fixture.observe },
      ),
    );
    assert.equal(result.code, -1);
    assert.equal(result.timedOut, true);
    assert.equal(result.outputLimitExceeded, false);
    assert.match(result.stdout, /TERM ignored/);
    assert.ok(Date.now() - started < 3000, "Timeout must include bounded escalation and drain");
    await assertChildrenGone(fixture.pids);
  },
);

test.skipIf(process.platform === "win32")(
  "acceptance timeout closes pipes held by a descendant after its parent exits",
  async (t) => {
    const fixture = processFixture(t);
    const descendant = [
      "process.on('SIGTERM', () => {});",
      "process.stdout.write('PID:' + process.pid + '\\n');",
      "setInterval(() => {}, 1000);",
    ].join("\n");
    const parent = [
      "const { spawn } = require('node:child_process');",
      "process.stdout.write('PID:' + process.pid + '\\n');",
      `spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: ['ignore', 'inherit', 'inherit'] });`,
      "setTimeout(() => { process.stdout.write('parent exited\\n'); process.exit(0); }, 200);",
    ].join("\n");
    const result = await fixture.bounded(
      runPortabilityProcess("node", ["-e", parent], {
        ...options,
        timeoutMs: 800,
        killGraceMs: 75,
        onStdout: fixture.observe,
      }),
    );
    assert.equal(result.code, -1, "Parent exit zero cannot turn a held-pipe timeout into success");
    assert.equal(result.timedOut, true);
    assert.equal(fixture.pids.size, 2);
    assert.match(result.stdout, /parent exited/);
    await assertChildrenGone(fixture.pids);
  },
);

test("acceptance output limit stops a real streaming child and caps combined retained bytes", async (t) => {
  const fixture = processFixture(t);
  const result = await fixture.bounded(
    runPortabilityProcess(
      "node",
      [
        "-e",
        [
          "process.on('SIGTERM', () => {});",
          "process.stdout.write('PID:' + process.pid + '\\n');",
          "setTimeout(() => setInterval(() => { process.stdout.write('x'.repeat(8192)); process.stderr.write('y'.repeat(8192)); }, 1), 40);",
        ].join("\n"),
      ],
      { ...options, timeoutMs: 2000, killGraceMs: 75, maxOutputBytes: 2048, onStdout: fixture.observe },
    ),
  );
  assert.equal(result.code, -1);
  assert.equal(result.outputLimitExceeded, true);
  assert.equal(result.timedOut, false);
  assert.ok(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) <= 2048);
  await assertChildrenGone(fixture.pids);
});

test("acceptance interactive stop ends a real child while preserving received protocol output", async (t) => {
  const fixture = processFixture(t);
  let replied = false;
  const result = await fixture.bounded(
    runPortabilityProcess(
      "node",
      [
        "-e",
        [
          "process.on('SIGTERM', () => {});",
          "process.stdout.write('PID:' + process.pid + '\\nREADY\\n');",
          "require('node:readline').createInterface({ input: process.stdin }).on('line', line => { if (line === 'continue') process.stdout.write('ACK\\n'); });",
          "setInterval(() => {}, 1000);",
        ].join("\n"),
      ],
      {
        ...options,
        keepStdinOpen: true,
        timeoutMs: 2000,
        killGraceMs: 75,
        onStdout(text, controls) {
          fixture.observe(text);
          if (text.includes("READY") && !replied) {
            replied = true;
            controls.write("continue\n");
          }
          if (text.includes("ACK")) controls.stop();
        },
      },
    ),
  );
  assert.equal(replied, true);
  assert.match(result.stdout, /ACK/);
  assert.equal(result.timedOut, false);
  assert.equal(result.outputLimitExceeded, false);
  await assertChildrenGone(fixture.pids);
});

test("acceptance protocol callback failure rejects only after cleaning up the child", async (t) => {
  const fixture = processFixture(t);
  await assert.rejects(
    fixture.bounded(
      runPortabilityProcess(
        "node",
        [
          "-e",
          [
            "process.on('SIGTERM', () => {});",
            "process.stdout.write('PID:' + process.pid + '\\nREADY\\n');",
            "setInterval(() => {}, 1000);",
          ].join("\n"),
        ],
        {
          ...options,
          keepStdinOpen: true,
          timeoutMs: 2000,
          killGraceMs: 75,
          onStdout(text) {
            fixture.observe(text);
            if (text.includes("READY")) throw Error("Invalid local protocol fixture");
          },
        },
      ),
    ),
    /Invalid local protocol fixture/,
  );
  await assertChildrenGone(fixture.pids);
});
