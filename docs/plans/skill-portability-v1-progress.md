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

## Stage 3 — validation and analysis

- Status: completed, 2026-10-29.
- Baseline/design commit: `1ab97d6bd99a2e83a8788ade501f554790e511dc`; audit commit: `fc9ce5169c2ae665ee368b1ef144105209cdb958`.
- Files: `plugins/foundry/src/core/portability/{types,validate}.ts`, shared ZIP/path safety helper, Foundry package YAML dependency, `test/unit/skill-portability-validation.test.ts`, Vitest unit include, plan/design/progress.
- Decisions: parse YAML safely (duplicate keys/aliases/tags rejected); render missing frontmatter from metadata only; published-and-passing requirement; bounded root-relative resource closure; complete registry-driven Usora dependency recognition; secrets never echoed; UTF-8 and cross-platform filename checks; compare source/config bytes and reject active lifecycle locks without writing a lock.
- Actual commands: `npm exec --yes --package bun@1.3.14 -- bun install --no-save` succeeded; `node_modules/.bin/tsc --noEmit` passed; focused Prettier/Oxlint passed. `node_modules/.bin/vitest run test/unit/skill-portability-validation.test.ts test/unit/skill-portability-export.test.ts` passed **2 files / 61 tests**, including **42 validator tests**.
- Failure/fix: first validation run was 40/41 (platform/environment credential detection missed a case). Fixed case-insensitive PowerShell and credential scanning; added standalone Foundry tool detection, space-containing resource parsing and writer-lock regression. Retest passed all 42 validator cases. Initial in-progress TS `in`-operand error and control-character lint warning were fixed before acceptance.
- Commit: recorded in the next chronological stage.
- Risks: static dependency analysis is conservative; unrecognized dynamic behaviors need review, and independent eligibility is not execution proof.
- Next: commit verified directory/ZIP export, then MCP integration and full acceptance.

## Stage 4 — directory and deterministic ZIP export

- Status: completed, 2026-10-29.
- Stage 3 commit: `ae0f746e39f6ce86bbd1d4cef50ea75b5b07b810`.
- Files: `portability/export.ts`, `tooling/package-plugin.ts` (shared ZIP reuse), `test/unit/skill-portability-export.test.ts`, plan/progress. Shared ZIP/path helper was included in stage 3 because validation also uses its cross-platform path checks.
- Decisions: immutable validated buffers; existing absolute parent; canonical/lexical protection of Knowledge, host config relocation and plugin/repository roots; exclusive per-target lock; staged commit; exact-target overwrite with rollback; no empty directories. UTF-8 ZIP32 STORE, sorted entries, fixed time, CRC and Unix modes.
- Commands/results: focused exporter suite **19/19 passed** including Python zipfile independent CRC/path/UTF-8/mode checks, Chinese/space names, deterministic ordering, concurrent lock conflicts and injected rollback failure. Combined validator/exporter run **61/61 passed**, 2.69s. `bun tooling/package-plugin.ts --check foundry`, actual package and `unzip -t artifacts/usora-foundry-1.5.3.zip` passed (12 entries; final bundle verification repeats after final build). `tsc --noEmit` and focused Prettier/Oxlint passed.
- Issue/fix: corrected shared import path, canonicalized symlink aliases of protected data roots, handled native Windows separators distinctly from foreign Windows paths. Alias regression uses isolated Node and protects even nonexistent root suffixes.
- Commit: recorded by following stage.
- Risks: exported paths are protected against cooperating processes with an exclusive target lock; hostile local TOCTOU mutation is outside the documented threat model. If both commit and rollback fail, preserve original backup and report its location instead of deleting data.
- Next: MCP stage commit, independent security review fixes and full repository checks.

## Security review correction after stage 4

- Independent review found two reproducible defects: quoted JSON secret keys escaped assignment scanning, and a detected token in an unknown YAML key/URL/file path could be echoed by other report fields. These were real failures, not accepted risks.
- Fixed quoted JSON/YAML/TOML assignments and ordinary token/secret keys. Any detected secret now returns a generic redacted report with no untrusted filenames, dependencies or warnings, and no snapshot; unknown frontmatter keys are never echoed.
- Added two regressions covering assignment syntax and full-report leakage through key, URL and filename channels. `node_modules/.bin/vitest run test/unit/skill-portability-validation.test.ts`: **44/44 passed**, 1.85s (`work/validation-security-retest.log`). TypeScript/Oxlint passed; feature bundle rebuilt successfully.
- Stage 4 commit: `9a3b136` (full SHA in final ledger). Correction commit recorded by next stage.

## Stage 5 — MCP integration

- Status: completed, 2026-10-29.
- Security correction commit: `0c2d32a4ce5994372f039abdf0b140cde201f9ed`.
- Files: `core/skill-portability.ts`, MCP handlers/tool schemas, built `dist/mcp.js`, built-in Skill mapping, `test/integration/foundry-skill-portability.test.ts`, lint/format generated-output exclusions, plan/progress. Final small validation failure-label hardening and sensitive-name fixture loop are included.
- Decisions: strict runtime arguments in addition to declarative MCP schema; new read-only tools dispatch before ensure; invalid validation returns exported=false without output; existing errors retain stable prefix codes. No manifest/version/Maintainer/publish/evolve changes.
- Actual command: `node_modules/.bin/vitest run test/integration/foundry-skill-portability.test.ts` passed **5/5**, 8.18s after lifecycle SOURCE_BUSY regression. Full Candidate→Draft→Evaluate→Publish→Validate→directory/ZIP flow, exact source hash equality, Maintainer rejection, v1/noHub behavior, query/get, conflicts, overwrite, dependencies and Chinese paths all passed. Build/TypeScript and owned lint/format passed.
- Issue/fix: bundling maintained YAML produces third-party generated code with lint warnings; exclude generated dist/artifacts/work from source lint and generated work/artifacts from formatting, while all authored source remains checked. Initial full check reached marketplace freshness and failed because an earlier local package's ignored checksum file overrode the existing release checksum; moved that local-only file to work and reran without changing published marketplace metadata.
- Commit: recorded in next stage ledger.
- Risk: actual Codex local Skill loading passed, but model task is blocked by enforced proxy CONNECT403 to chatgpt.com. No false task-success claim.
- Next: full check, doctor, final package/unzip, demo evidence and documentation; preserve isolated-task external blocker.
