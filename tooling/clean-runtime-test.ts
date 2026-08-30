import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverPlugins } from "./discover-plugins";

const root = process.cwd();
const requested = process.argv.filter((arg) => !arg.startsWith("--")).slice(2);

function runNode(script: string, input: string, cwd: string): Promise<string> {
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
    child.stdin.end(input);
  });
}

const plugins = (await discoverPlugins(root)).filter(
  (plugin) => requested.length === 0 || requested.includes(plugin.manifest.name),
);
if (requested.length && plugins.length !== requested.length) throw Error(`Unknown plugin(s): ${requested.join(", ")}`);

for (const plugin of plugins) {
  const stage = path.join(root, "artifacts", plugin.manifest.name);
  const cwd = await mkdtemp(path.join(os.tmpdir(), `usora-${plugin.manifest.name}-runtime-`));
  try {
    const mcp = path.join(stage, plugin.manifest.entrypoints.mcp ?? "");
    const output = await runNode(
      mcp,
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })}\n`,
      cwd,
    );
    const response = JSON.parse(output.trim());
    if (!Array.isArray(response.result?.tools)) throw Error(`${plugin.manifest.name} MCP tools/list failed`);

    const hook = plugin.manifest.entrypoints.sessionHook
      ? path.join(stage, plugin.manifest.entrypoints.sessionHook)
      : null;
    if (hook) {
      await writeFile(path.join(cwd, "transcript.jsonl"), "");
      await runNode(
        hook,
        `${JSON.stringify({ session_id: "clean-runtime", cwd, task: "runtime", result: "ok" })}\n`,
        cwd,
      );
      const activities = await readdir(path.join(cwd, ".usora", "activities"));
      if (activities.length !== 1) throw Error(`${plugin.manifest.name} session hook failed`);
    }
    console.log(`clean runtime ok: ${plugin.manifest.name}`);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}
