import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createReleasePlan } from "./release-plan";

const publish = process.argv.includes("--publish");
const planIndex = process.argv.indexOf("--plan");
const planFile = planIndex >= 0 ? process.argv[planIndex + 1] : undefined;

type ReleasePlan = Awaited<ReturnType<typeof createReleasePlan>>;

async function readPlan(): Promise<ReleasePlan> {
  if (!planFile) return createReleasePlan();
  try {
    return JSON.parse(await readFile(planFile, "utf8")) as ReleasePlan;
  } catch {
    return createReleasePlan();
  }
}

const plan = await readPlan();

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

function succeeds(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

for (const plugin of plan.plugins) {
  await access(plugin.artifact);
  await access(plugin.checksum);
  const checksum = (await readFile(plugin.checksum, "utf8")).trim().split(/\s+/)[0];
  const notes = `Release ${plugin.name} ${plugin.version}\n\nChecksum: sha256:${checksum}`;

  if (!publish) {
    console.log(`release ready: ${plugin.tag} ${plugin.artifact}`);
    continue;
  }

  const exists = execFileSync("git", ["tag", "--list", plugin.tag], { encoding: "utf8" }).trim();
  if (!exists) run("git", ["tag", plugin.tag]);
  run("git", ["push", "origin", plugin.tag]);
  if (succeeds("gh", ["release", "view", plugin.tag])) {
    run("gh", ["release", "upload", plugin.tag, plugin.artifact, plugin.checksum, "--clobber"]);
  } else {
    run("gh", [
      "release",
      "create",
      plugin.tag,
      plugin.artifact,
      plugin.checksum,
      "--title",
      `${plugin.name} ${plugin.version}`,
      "--notes",
      notes,
      "--verify-tag",
    ]);
  }
  console.log(`released ${plugin.tag}`);
}
