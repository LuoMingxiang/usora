import { execFileSync } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const push = process.argv.includes("--push");
const root = process.cwd();
const source = path.join(root, "artifacts", "marketplace");
const worktree = await mkdtemp(path.join(os.tmpdir(), "usora-marketplace-"));

function git(args: string[]): void {
  execFileSync("git", args, { cwd: worktree, stdio: "inherit" });
}

await cp(source, worktree, { recursive: true });
git(["init"]);
git(["checkout", "-b", "marketplace"]);
git(["add", "."]);
git([
  "-c",
  "user.name=usora-release",
  "-c",
  "user.email=release@usora.local",
  "commit",
  "-m",
  "chore: publish marketplace distribution",
]);

if (push) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  git(["remote", "add", "origin", "https://github.com/LuoMingxiang/usora.git"]);
  if (token) {
    const auth = Buffer.from(`x-access-token:${token}`).toString("base64");
    git(["-c", `http.extraheader=AUTHORIZATION: basic ${auth}`, "push", "--force", "origin", "marketplace"]);
  } else {
    git(["push", "--force", "origin", "marketplace"]);
  }
  await rm(worktree, { recursive: true, force: true });
}

console.log(push ? "published marketplace branch" : `marketplace branch prepared at ${worktree}`);
