import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";
import { calculateAffectedPlugins } from "../../tooling/affected-plugins";
import { discoverPlugins } from "../../tooling/discover-plugins";
import { createReleasePlan } from "../../tooling/release-plan";
import { createVersionPlan } from "../../tooling/version-plugin";
import { validatePluginManifest } from "../../packages/plugin-schema/src/index";
import { definePlugin } from "../../packages/plugin-sdk/src/index";

const validManifest = {
  schemaVersion: 1,
  name: "example",
  version: "0.1.0",
  description: "Example plugin",
  runtime: { node: ">=20" },
  entrypoints: { mcp: "dist/mcp.js" },
} as const;

test("manifest validation rejects source entrypoints", () => {
  assert.throws(
    () => validatePluginManifest({ ...validManifest, entrypoints: { mcp: "src/cli/mcp.ts" } }),
    /built JavaScript/,
  );
});

test("plugin discovery is manifest driven and rejects duplicates", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "usora-discovery-"));
  try {
    for (const dir of ["example", "second"]) {
      await mkdir(path.join(root, "plugins", dir), { recursive: true });
      await writeFile(
        path.join(root, "plugins", dir, "plugin.json"),
        `${JSON.stringify({ ...validManifest, name: dir }, null, 2)}\n`,
      );
    }

    assert.deepEqual(
      (await discoverPlugins(root)).map((plugin) => plugin.manifest.name),
      ["example", "second"],
    );

    await writeFile(path.join(root, "plugins", "second", "plugin.json"), `${JSON.stringify(validManifest, null, 2)}\n`);
    await assert.rejects(() => discoverPlugins(root), /name must match directory|Duplicate plugin name/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("packaged artifact excludes source files", async () => {
  for (const plugin of await discoverPlugins()) {
    const stage = path.resolve("artifacts", plugin.manifest.name);
    const manifest = JSON.parse(await readFile(path.join(stage, "plugin.json"), "utf8"));
    const mcp = JSON.parse(await readFile(path.join(stage, ".mcp.json"), "utf8"));

    for (const item of ["dist/mcp.js", "dist/session-hook.js", "plugin.json", ".mcp.json"]) {
      await access(path.join(stage, item));
    }
    for (const entrypoint of Object.values(manifest.entrypoints)) {
      assert.equal(typeof entrypoint, "string");
      await access(path.join(stage, entrypoint as string));
    }
    for (const server of Object.values(mcp) as Array<{ args?: string[] }>) {
      const script = server.args?.find((arg) => arg.endsWith(".js"));
      assert.ok(script);
      await access(path.join(stage, script));
    }
    await assert.rejects(readFile(path.join(stage, "src/mcp/server.mjs"), "utf8"));
  }
});

test("CodeBuddy marketplace uses relative sources CodeBuddy can load", async () => {
  const marketplace = JSON.parse(await readFile(path.resolve(".codebuddy-plugin/marketplace.json"), "utf8"));
  const entries = new Map(marketplace.plugins.map((entry: { name: string }) => [entry.name, entry]));

  for (const plugin of await discoverPlugins()) {
    const entry = entries.get(plugin.manifest.name) as {
      source?: string;
    };
    assert.equal(entry.source, `./${plugin.dir.replaceAll("\\", "/")}`);
    await access(path.resolve("artifacts/marketplace", entry.source, plugin.manifest.entrypoints.mcp ?? ""));
  }
});

function runNode(script: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd,
      env: { ...process.env, NODE_PATH: "" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => (code === 0 ? resolve(stdout) : reject(Error(stderr || `node exited ${code}`))));
    child.stdin.end(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })}\n`);
  });
}

test("packaged plugins start from an isolated directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "usora-packaged-runtime-"));
  try {
    for (const plugin of await discoverPlugins()) {
      const stage = path.resolve("artifacts", plugin.manifest.name);
      const output = await runNode(path.join(stage, plugin.manifest.entrypoints.mcp ?? ""), root);
      const response = JSON.parse(output.trim());
      assert.ok(Array.isArray(response.result?.tools));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("affected plugin analysis classifies plugin, shared, tooling, and docs-only changes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "usora-affected-"));
  try {
    for (const dir of ["foundry", "reviewer"]) {
      await mkdir(path.join(root, "plugins", dir), { recursive: true });
      await writeFile(
        path.join(root, "plugins", dir, "plugin.json"),
        `${JSON.stringify({ ...validManifest, name: dir }, null, 2)}\n`,
      );
    }
    await writeFile(
      path.join(root, "plugins", "foundry", "package.json"),
      JSON.stringify({ dependencies: { "@usora/plugin-sdk": "workspace:*" } }),
    );
    await writeFile(path.join(root, "plugins", "reviewer", "package.json"), JSON.stringify({ dependencies: {} }));

    assert.deepEqual(await calculateAffectedPlugins(["plugins/foundry/src/core/hub.ts"], root), ["foundry"]);
    assert.deepEqual(await calculateAffectedPlugins(["plugins\\reviewer\\src\\index.ts"], root), ["reviewer"]);
    assert.deepEqual(await calculateAffectedPlugins(["packages/plugin-sdk/src/index.ts"], root), ["foundry"]);
    assert.deepEqual(await calculateAffectedPlugins(["packages/plugin-schema/src/index.ts"], root), [
      "foundry",
      "reviewer",
    ]);
    assert.deepEqual(await calculateAffectedPlugins(["tooling/build-plugin.ts", "package.json"], root), [
      "foundry",
      "reviewer",
    ]);
    assert.deepEqual(await calculateAffectedPlugins(["docs/plugin.zh-CN.md"], root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("plugin SDK definePlugin preserves the manifest contract", () => {
  assert.deepEqual(definePlugin(validManifest), validManifest);
});

test("release planning combines changed paths, commit scopes, and version consistency", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "usora-release-plan-"));
  try {
    for (const dir of ["foundry", "reviewer"]) {
      await mkdir(path.join(root, "plugins", dir), { recursive: true });
      await writeFile(
        path.join(root, "plugins", dir, "plugin.json"),
        `${JSON.stringify({ ...validManifest, name: dir, version: dir === "foundry" ? "1.1.0" : "0.2.0" }, null, 2)}\n`,
      );
      await writeFile(
        path.join(root, "plugins", dir, "package.json"),
        `${JSON.stringify({ version: dir === "foundry" ? "1.1.0" : "0.2.0", dependencies: {} }, null, 2)}\n`,
      );
    }

    const plan = await createReleasePlan({
      root,
      changed: ["docs/plugin.md"],
      commits: ["feat(foundry): add release scoped feature"],
    });
    assert.deepEqual(
      plan.plugins.map((plugin) => plugin.tag),
      ["foundry-v1.1.0"],
    );

    await writeFile(path.join(root, "plugins", "foundry", "package.json"), JSON.stringify({ version: "9.9.9" }));
    await assert.rejects(
      () =>
        createReleasePlan({
          root,
          changed: ["plugins/foundry/src/index.ts"],
          commits: [],
        }),
      /version mismatch/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("plugin version planning bumps only releasable commits", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "usora-version-plan-"));
  try {
    for (const dir of ["foundry", "reviewer"]) {
      await mkdir(path.join(root, "plugins", dir), { recursive: true });
      await writeFile(
        path.join(root, "plugins", dir, "plugin.json"),
        `${JSON.stringify({ ...validManifest, name: dir, version: "1.1.0" }, null, 2)}\n`,
      );
      await writeFile(path.join(root, "plugins", dir, "package.json"), `${JSON.stringify({ version: "1.1.0" })}\n`);
    }

    const scoped = await createVersionPlan({
      root,
      changed: ["docs/plugin.md"],
      commits: ["feat(foundry): add release scoped feature"],
    });
    assert.deepEqual(scoped.plugins, [
      {
        name: "foundry",
        dir: path.join("plugins", "foundry"),
        currentVersion: "1.1.0",
        nextVersion: "1.2.0",
        bump: "minor",
      },
    ]);

    const unscoped = await createVersionPlan({
      root,
      changed: ["plugins/reviewer/src/index.ts"],
      commits: ["fix: patch affected plugin"],
    });
    assert.deepEqual(unscoped.plugins, [
      {
        name: "reviewer",
        dir: path.join("plugins", "reviewer"),
        currentVersion: "1.1.0",
        nextVersion: "1.1.1",
        bump: "patch",
      },
    ]);

    const releaseCommit = await createVersionPlan({
      root,
      changed: ["plugins/foundry/plugin.json"],
      commits: ["chore(release): foundry v1.2.0"],
    });
    assert.deepEqual(releaseCommit.plugins, []);

    await writeFile(
      path.join(root, "plugins", "foundry", "package.json"),
      `${JSON.stringify({ version: "1.1.0", dependencies: { "@usora/plugin-sdk": "workspace:*" } })}\n`,
    );
    const sharedScope = await createVersionPlan({
      root,
      changed: ["packages/plugin-sdk/src/index.ts"],
      commits: ["feat(plugin-sdk): improve shared plugin API"],
    });
    assert.deepEqual(sharedScope.plugins, [
      {
        name: "foundry",
        dir: path.join("plugins", "foundry"),
        currentVersion: "1.1.0",
        nextVersion: "1.2.0",
        bump: "minor",
      },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
