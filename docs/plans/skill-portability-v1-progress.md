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

## Stage 6 — automation and independent acceptance

- Status: all local checks completed; **independent model task blocked**, not marked complete.
- Code/MCP commit: `779d2e8faf580a6f883ecc78189d93c76ddba3dc`.
- Files: reproducible `scripts/skill-portability-demo.ts`, fixture, `acceptance.md`, local/host evidence JSON, plan/progress.
- Actual commands: `npm exec --yes --package bun@1.3.14 -- bun run check` final exit0; **18 test files / 133 tests passed** (65 existing +44 validation +19 export +5 MCP), 25.73s. All format/lint/type/build/package/runtime/marketplace/doctor gates passed. Explicit doctor exit0. Actual package/unzip exit0 (12 entries), plugin archive SHA `052a438dbaa031c8e0f69efb6794b282425300d3d523eccc8fb905775e689f89`. Final `node scripts/skill-portability-demo.ts` exit0; validated ZIP SHA `e00e8e5fa4317be3f5df0afe8c03a8c0d57d82863bbe2182d1b1f89e21d02653`; source tree hashes equal.
- Genuine host command: `node scripts/skill-portability-demo.ts --host --host-timeout-ms 60000` exit1, model task blocked by proxy HTTP CONNECT403 at chatgpt.com. Codex 0.163.0 local `app-server skills/list` **passed** (enabled repo Skill, no parse errors, pluginId=null); loader success is not task execution. App-server uses installed config; model task exec uses --ignore-user-config in temp project with no Hub. No task output claimed.
- Evidence: `docs/examples/skill-portability/{acceptance.md,evidence-local.json,evidence-host.json}`; raw local command logs in ignored work.
- Independent security reviewer retest **4/4 pass**: quoted API/password/token keys, punctuation password, token in unknown key and URL; invalid report, no snapshot, no supplied values anywhere in serialized report.
- Problems/fixes: formatting and generated dependency lint corrected; local ignored release checksum moved aside to avoid stale marketplace check (no release metadata change). Rebuilt and full retest passed.
- Remaining blocker: enforced environment lacks chatgpt.com allow rule; no supported config mutation tool exposed. Existing authenticated host cannot execute model tasks. No proxy bypass or fake execution. Native Windows/CodeBuddy unverified.
- Next: document delivery, push branch and open a draft PR with explicit outstanding host-task gate.

## Full commit ledger through tested code

- `fc9ce5169c2ae665ee368b1ef144105209cdb958` — docs: audit Skill portability lifecycle and runtime
- `1ab97d6bd99a2e83a8788ade501f554790e511dc` — docs: define Skill portability contracts and security policy
- `ae0f746e39f6ce86bbd1d4cef50ea75b5b07b810` — feat(foundry): validate portable Skill snapshots and dependencies
- `9a3b1365aeadd8e22b9f8f9f58c6a61be0b006f3` — feat(foundry): export Skill directories and deterministic ZIP archives
- `0c2d32a4ce5994372f039abdf0b140cde201f9ed` — fix(foundry): detect quoted credentials and redact validation reports
- `779d2e8faf580a6f883ecc78189d93c76ddba3dc` — feat(foundry): expose read-only Skill validation and export tools

## Stage 7 — documentation and PR delivery

- Status: completed delivery with the stage 6 external model-task blocker explicitly retained.
- Files: README English/Chinese, plugin guides English/Chinese, portability usage/API/troubleshooting guide, audit/design/plan/progress, fixture and acceptance evidence. No UI, publisher, cloud sync or release changes.
- Prior commits: `f278a23` acceptance harness/evidence; `c30fd0a82cc2a0461eb3b891a386b842ad39be81` user documentation and initially pushed head. Full SHAs are in git history; final delivery HEAD is recorded in PR metadata and user report rather than self-referencing this file.
- Verified: `git diff --check`; final document Prettier check passed; final tested code passed full check133/133 plus doctor/package/unzip/demo. Worktree contained only intended documentation before delivery update. Git fetch confirmed master remains `3eb0e8876070a8306b096c0e27590ef731bc9ca2`.
- Git workflow: normal non-force push to `feat/skill-portability-v1` succeeded; created **draft PR https://github.com/LuoMingxiang/usora/pull/14**, base master. The draft records the incomplete model-task gate rather than claiming all requirements passed. No PR merge or production release.
- Actual artifacts: deterministic Skill directory+ZIP, per-file and archive SHA256, local evidence and blocked host evidence. Durable evidence lives in docs/examples/skill-portability; downloadable outputs are also supplied with the final user report.
- Remaining work: permit chatgpt.com through supported environment policy, rerun `node scripts/skill-portability-demo.ts --host --host-timeout-ms 60000`, require actual release-notes.json contract assertion, then update evidence/checkbox and mark PR ready. Native Windows/CodeBuddy tasks remain unverified; static scanner and cooperating-process filesystem limits remain documented.
- Next: observe remote CI where available; final report must say stage 6 is blocked and supply exact HEAD/PR/artifact links.

## Delivery artifact and remote CI confirmation

- GitHub Actions for `ded748d2802365d407c60c5fa6b03431eadd164c`: CI run40869636488 **success**, Commitlint run40869636469 **success**. This confirms remote as well as local checks for the tested implementation/documentation.
- Added the actual 1.7KB exported Skill ZIP as an intentional acceptance sample under docs/examples/skill-portability/portable-release-notes.zip, with the previously verified deterministic checksum. Compared both exported directory files against the committed fixture directory: byte-identical. No plugin build archive or temporary Hub was committed.
- Standalone output-mount delivery is unavailable in this cloud executor: the configured /codex/browser/.../output parent does not exist and /codex creation is denied; no sudo is installed. Therefore real artifacts are delivered through the authorized repository/PR example, not a broken local download link.
- Final commit SHA is available in PR head metadata and the final user report; last changes are acceptance documentation and the intentional sample ZIP only. The independent model-task CONNECT403 gate remains outstanding.

## Final specification boundary correction

- A final AST review found that YAML numeric/collection mapping keys were silently coerced to strings by toJS, violating the string-key metadata contract; collection keys also generated a warning containing source data. Added two tests first: **44 passed / 2 failed**, plus the reproduced collection-key warning (`work/metadata-keys-before.log`).
- Reject nonstring mapping keys at the YAML AST stage before any JS conversion or warning. Focused retest **46/46 passed** (1.49s); full `bun run check` **18 files /135 tests passed**,37.38s, every format/lint/type/build/package/runtime/marketplace/doctor stage successful (`work/final-metadata-check.log`).
- Rebuilt runtime and final local demo exit0 again (`artifacts/skill-portability/run-beiNDp/evidence.json`). The package's Markdown/resources and deterministic Skill ZIP remain byte-identical. No repeat of blocked model execution was claimed.
- Files: validator,46-case unit suite, generated Node bundle, this progress entry. This is a concrete defect correction, not a new export profile or scope expansion.

## Final retest delivery snapshot

- Final tested implementation commit: `b68fbf75a12a3620c66a6bcc27330f5f94f48bc7`. Final full check **135/135 passed** (46 validator+19 exporter+5 MCP+65 existing),18 files,37.38s. Prior133-test results above are chronological evidence, superseded by this final run.
- Final actual plugin archive+unzip passed, SHA256 `1b12b5a51c18493c5fc56d0a2ffdbb37e26bd025cd98523750051c430f9c0d37`; local checksum override moved out again.
- Replaced local acceptance JSON with final demo evidence; source hashes still equal; both fixture files and committed real Skill ZIP compared byte-for-byte with final exports. Skill ZIP SHA remains `e00e8e5fa4317be3f5df0afe8c03a8c0d57d82863bbe2182d1b1f89e21d02653`. Host task remains blocked by same external policy; its actual attempt evidence is preserved.
- CI/Commitlint for sample commit `1a628c89b6f05468b8063451454c86610b083fd9` both succeeded (runs40870008697/40870008596). Final correction will be pushed and checked; no master change/merge/release.

## Follow-up audit and reopened robustness work — 2026-10-30

- Baseline: clean `7a34bd4fced8e3b580c4a19a3455b89992a57f84` on requested branch, remote fetch identical; PR14 remains open/draft/unmerged.
- Pending original requirement: stage6 real independent model task. Fresh environment observations current, running, restricted/enforced; chatgpt.com still absent. User replied they will allow it and notify; dependent host rerun waits for confirmation, without bypassing proxy. Runtime/networking skill re-read as required.
- Independent audits reproduced new ordinary defects: ps1/cmd/bat/ts scripts reported independent with no runtime; Python token=word.lower() rejected as a credential;1500 missing references bypass100-file processing bound; export cleanup exceptions overwrite a successful commit or recovery failure; SIGTERM-ignoring child can hang acceptance indefinitely. These are reopened fixes, not accepted as completed from the prior135-test baseline.
- Architectural decision: pure content analysis and adapter-neutral tool-name catalog; core must not initialize MCP schemas. Keep existing Hub/lifecycle/manifest intact.
- Work in progress owned by modules; actual red/green command results and resulting commits will be recorded after execution. No unexecuted tests or pending network task marked passed.
- AGENTS session aggregation remains unavailable: no exposed activity_capture connector or stable current conversation session ID; no synthetic activity capture is created.

### Follow-up checkpoint A — bounded acceptance processes

- Completed: ordinary commands and interactive Codex loader now share acceptance-only scripts/lib/skill-portability-process.ts. Positive timeout/output limits, TERM→KILL escalation, owned POSIX process-group cleanup, bounded inherited-pipe draining,4MiB combined stdout/stderr and explicit timeout/output-limit metadata. No production runtime coupling.
- Red evidence: old runner remained pending650ms after200ms timeout when Node child ignoredSIGTERM; external watchdog reaped it.
- Green commands: `node_modules/.bin/vitest run test/unit/skill-portability-process.test.ts` **7/7 passed**,2.01s; owned Prettier/Oxlint passed. Tests use real children and verify no live descendants, including ignoredTERM, inherited pipes, overflow, interactive stop, callback failure, ENOENT and normal IO.
- Real no-host demo exit0: artifacts/skill-portability/run-Zc1rhx/evidence.json, source hashes equal, ZIP unchanged. This used the existing built runtime; final build+demo will be repeated after other concrete fixes. No network attempt while user is preparing policy.
- Files: dedicated helper, demo orchestration,7-case unit file, plan/progress. Remaining core/export changes are still in progress and not falsely covered by this checkpoint. Commit SHA is recorded at subsequent checkpoint.

### Follow-up checkpoint B — export transaction integrity

- Previous checkpoint commit: `de2684a6c601c2da8b3917cd0be8120dbf198d45`.
- Concrete red evidence: work/portability-failure-audit.json,5 passing reproduction assertions of old broken behavior: postcommit EACCES replaced success, lock cleanup blocked retries, cleanup masked recovery failure; late ZIP target overwrote default policy; invalid Unicode entries collapsed to duplicate encoded names. No source data was modified by repro.
- Fixed: committed output returns exported=true even if cleanup fails, with EXPORT_CLEANUP_FAILED and optional recovery cleanup paths/backup/lock evidence. Precommit failures preserve their primary code and any rollback backup location. No active/stale lock is stolen; BUSY gives recovery location and requires confirming prior process stopped.
- Default ZIP now atomically links staged file to absent target; EEXIST preserves another writer's bytes. It requires hard-link support on the output filesystem and fails safely otherwise. Existing directory concurrency threat boundary remains unchanged.
- Reject invalid Unicode filenames before ZIP encoding. Validate malformed helper snapshot/report shape and positive revision; match path/bytes/SHA256 evidence and copy buffers/report/options before first await to avoid in-process changes corrupting consistency. Public fields are reconstructed without cloning unknown callbacks/debug data.
- Actual verification: `node_modules/.bin/vitest run test/unit/skill-portability-export.test.ts` **29/29 passed**,803ms; owned Prettier/Oxlint and git diff --check passed. No broad typecheck success is claimed while parallel validator refactor is incomplete.
- Files: export.ts, shared zip.ts,29-case exporter unit suite, plan/progress. Commit SHA is recorded at the next checkpoint.
