# Skill Portability v1 — progress and evidence

All dates use Asia/Shanghai. Branch: `feat/skill-portability-v1`. Evidence is recorded only after execution. Intermediate logs are in ignored `work/`; durable acceptance evidence will be committed under `docs/examples/skill-portability/`.

## Stage 1 — repository audit

- Status: completed, 2026-10-29.
- Baseline: `6d6f99f9ed59607ba4157aa25147645f81d5683b`, clean worktree; master comparison `3eb0e88` contains plan only.
- Files: this progress log, plan status, `skill-portability-v1-audit.md`.
- Decisions: preserve lifecycle and Hub schema; selected published Skill is source; render standard frontmatter at export; reuse ZIP algorithm; use real isolated Codex for host acceptance.
- Commands: `git status --short --branch`, `git diff 3eb0e88 --stat`, `node --version`, `npm exec --yes --package bun@1.3.14 -- bun --version`; read all Foundry source areas and existing integration/CI/tooling. Official spec fixed commit is linked in audit.
- Results: Node v24.19.0, Bun 1.3.14 available through npm exec. Initial `bun run check` stopped at Prettier on the original plan; formatting is corrected with this stage. Baseline test outcome is recorded in the next stage after the running command finishes.
- Issue/fix: shallow checkout only mapped master, so fetch returned FETCH_HEAD without a remote-tracking branch. Created requested local branch from that fetched head, configured its upstream explicitly; no master writes.
- Commit: recorded by the next stage's commit ledger (avoids self-referential SHA).
- Risk: static analysis cannot prove all runtime dependencies. No native Windows/CodeBuddy runtime is installed. Automatic Activity aggregation unavailable because no connector tool/stable session ID is exposed.
- Next: design contracts and security policy before feature code.

## Commit ledger

The next chronological commit records each stage commit's full SHA; final delivery records the final HEAD externally in the PR and chat. No file claims to contain its own commit SHA.

## Stage 2 — contract and design

- Status: completed, 2026-10-29.
- Baseline: `fc9ce51`; stage 1 commit `fc9ce51` (full SHA from git below).
- Files: design, plan, progress.
- Decisions: published-only, `skill_id` selects existing directory; absolute existing export parent; explicit conflict overwrite; bounded snapshot and resource closure; dependency eligibility distinguished from execution; shared deterministic ZIP helper. No new host profile or schema.
- Verification: reviewed design against all stage 2 requirements and audited source; `npm exec --yes --package bun@1.3.14 -- bun run test` passed **15 files / 65 tests** on baseline (12.58s). Design Markdown formatted by Prettier. No feature tests claimed at this design-only stage.
- Issue/fix: optional Unicode skill names in official reference exceed existing Hub ASCII schema; preserve current schema and document conservative subset instead of globally changing safeName.
- Commit: recorded in following stage ledger.
- Risk: static reference/dependency scanning has documented limits; final real-host verification required.
- Next: validator unit implementation, then atomic directory/ZIP export.
