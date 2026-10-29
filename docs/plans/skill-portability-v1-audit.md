# Skill Portability v1 — source audit

Audit date: 2026-10-29 (Asia/Shanghai). Starting HEAD: `6d6f99f9ed59607ba4157aa25147645f81d5683b`; branch `feat/skill-portability-v1`; clean worktree. Compared with master baseline `3eb0e88`, only the implementation plan differs. No user changes were overwritten.

## Runtime and verification

Node is v24.19.0. Bun was missing; `npm exec --yes --package bun@1.3.14 -- bun ...` supplies the repository's pinned Bun version without changing project dependencies. Vitest 4 runs `test/integration/*.test.ts`; tests spawn the built Node MCP entry, so build must precede integration tests. CI (`.github/workflows/ci.yml`) runs `bun run check` plus per-plugin build/package/runtime checks. `package.json` defines format, oxlint, TypeScript, build, package, clean runtime, marketplace, tests and doctor validation. The initial full check stops at a pre-existing Prettier issue in the plan; this will be corrected in the audit commit.

## Source and lifecycle

- `plugins/foundry/src/mcp/server.ts` serializes JSON-RPC calls; `mcp/handlers.ts` dispatches registered handlers; `mcp/tools/skill.ts` supplies schemas. Schemas are declarative, so handlers must validate arguments too.
- `core/storage.ts` resolves shared Knowledge from `USORA_HOME`, otherwise development `.usora` or installed `~/.usora`. Host config and shared Knowledge can differ. Skills must use `knowledgeDirPath("skills")`, not the host Hub root.
- `core/skills.ts` stores one current `skills/<name>/skill.json` plus `SKILL.md`: schema 2, name, description, duplicated content, source Candidate, state, revision and timestamps. Reads prefer Markdown, with JSON fallback. Export will require actual Markdown, and omit private lifecycle metadata from packages.
- `core/candidates.ts` creates OPEN Candidates; passing evaluation sets EVALUATED. Skill generation requires that passing Candidate. Skill creation writes DRAFT; evaluation sets EVALUATED/REJECTED; publication requires passing evaluation and configured Maintainer, sets PUBLISHED and increments revision. Evolution PATCH preserves state and increments revision. Export must never call these mutators or treat PUBLISHED as proof of portability.
- Generated Skill bodies have no frontmatter. The built-in `plugins/foundry/skills/usora-skill-hub/SKILL.md` has frontmatter but depends on Usora MCP. These are distinct sources; this feature exports explicitly selected user Hub Skills only.
- `core/skill-index.ts` queries metadata and may rebuild indexes; exporters should read the selected directory directly. `core/governance.ts` owns merged/deprecated/retired states and Maintainer decisions.

## Reuse and gaps

- `core/validation.ts` safeName allows uppercase, trailing/doubled hyphens; retain it for legacy storage and validate portable names separately.
- `core/lock.ts` supplies cooperating Skill write locks, but its process-global reentrancy is unsuitable for independent concurrent read guarantees. Use bounded double-read snapshots to detect changes; do not refactor lifecycle locks in this scope.
- `tooling/package-plugin.ts` already has deterministic ZIP32 STORE/CRC32 code. Extract a small shared ZIP writer, add UTF-8 filenames and bounds/path checks, and retain existing plugin packaging behavior.
- There is no user Skill exporter, YAML parser, resource model, dependency scanner or secret scanner. Use a maintained YAML parser bundled into Node dist; resource closure is restricted to scripts/references/assets, never arbitrary Hub files.
- `handlers.call()` currently runs `ensure()` for every tool, which can initialize directories and invoke legacy config migration. Dispatch the two new read-only tools before that call; inspect existing config directly and reject v1 migration requirements without mutating the Hub.

## Specification and host evidence

Canonical Agent Skills specification: [agentskills/agentskills docs/specification.mdx](https://github.com/agentskills/agentskills/blob/69ef37e9424c0a7ea9dd2293b559e43ec8176379/docs/specification.mdx), Git commit `69ef37e9424c0a7ea9dd2293b559e43ec8176379` (2026-08-09), retrieved 2026-10-29. The agentskills.io endpoint is blocked by the session proxy; the canonical GitHub source is accessible. Host differences are advisory, not additional export profiles.

`codex-cli 0.163.0` is installed and login status reports ChatGPT authentication. It supports `--ignore-user-config`, `--ephemeral`, `--skip-git-repo-check` and JSONL output. Independent acceptance will use a temp project outside this repository, only the extracted Skill under `.agents/skills`, no Usora config/Hub/MCP, and an actual task. No CodeBuddy/Claude CLI is installed; do not claim those hosts were run.

## Risk and acceptance mapping

Read-only invariants include Skill bytes/state/revision, events, indexes and usage. Reject symlink ancestors, traversal, drive/UNC paths, unsafe output overlap, oversized input and credentials. External services, platform commands and Usora MCP must appear as dependencies, with independent compatibility false when applicable. Static scans are conservative and cannot prove arbitrary prose/scripts safe or complete.

Regression anchors: `foundry-skill-retrieval-generation.test.ts`, `foundry-skill-evolution.test.ts`, `foundry-governance.test.ts`, `foundry-migration.test.ts`, `usora-mcp.test.ts`. Add unit tests and full MCP lifecycle/export tests, unzip with Python's independent ZIP reader, compare all bytes and hashes, run clean packaged runtime and real Codex task.

Repository AGENTS requests session activity aggregation. No Usora connector tool or stable current session ID is exposed here, so automatic aggregation is unavailable; no synthetic Activity will be created for this development conversation.
