import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createVersionPlan } from "./version-plugin";

const publish = process.argv.includes("--publish");
const bun = process.platform === "win32" ? "bun.cmd" : "bun";

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  execFileSync(command, args, { shell: process.platform === "win32", stdio: "inherit", env });
}

function output(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function hasGitChanges(): boolean {
  return output("git", ["status", "--porcelain"]).length > 0;
}

if (publish && hasGitChanges()) throw Error("release:ci --publish requires a clean worktree");

const versionPlan = await createVersionPlan();
const releasePlan = {
  changed: versionPlan.changed,
  commit_scopes: [],
  plugins: versionPlan.plugins.map((plugin) => ({
    name: plugin.name,
    version: plugin.nextVersion,
    tag: `${plugin.name}-v${plugin.nextVersion}`,
    artifact: `artifacts/usora-${plugin.name}-${plugin.nextVersion}.zip`,
    checksum: `artifacts/usora-${plugin.name}-${plugin.nextVersion}.sha256`,
  })),
};
if (versionPlan.plugins.length === 0) {
  await writeFile("release-plan.json", `${JSON.stringify(releasePlan, null, 2)}\n`);
  console.log("plugin release ci skipped: no releasable plugin commits");
  process.exit(0);
}

if (!publish) {
  await writeFile("release-plan.json", `${JSON.stringify(releasePlan, null, 2)}\n`);
  console.log("plugin release ci dry-run complete");
  process.exit(0);
}

run(bun, ["tooling/version-plugin.ts", "--write"]);
run(bun, ["run", "format"]);
run(bun, ["run", "build"]);
run(bun, ["run", "package"]);
run(bun, ["tooling/sync-marketplace.ts"]);
run(bun, ["run", "format"]);
run(bun, ["run", "check"]);
await writeFile("release-plan.json", `${JSON.stringify(releasePlan, null, 2)}\n`);

if (publish && hasGitChanges()) {
  const summary = versionPlan.plugins.map((plugin) => `${plugin.name} v${plugin.nextVersion}`).join(", ");
  run("git", ["config", "user.name", "usora-release-bot"]);
  run("git", ["config", "user.email", "usora-release-bot@users.noreply.github.com"]);
  run("git", ["add", "-A"]);
  run("git", ["commit", "-m", `chore(release): ${summary}`]);
  run("git", ["push", "origin", `HEAD:${process.env.GITHUB_REF_NAME || "master"}`]);
}

run(bun, ["tooling/release-plugin.ts", "--plan", "release-plan.json", ...(publish ? ["--publish"] : [])]);
run(bun, ["run", "marketplace:build"]);
run(bun, ["tooling/publish-marketplace-branch.ts", ...(publish ? ["--push"] : [])]);

console.log(publish ? "plugin release ci published" : "plugin release ci dry-run complete");
