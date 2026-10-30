# Skill Portability v1 — executed acceptance

Date: 2026-10-30 (Asia/Shanghai). Tested code commit: `d3f0f8b7d661a38c5bcf05bf16f9e9722667fd5d`. Node v24.19.0, Bun 1.3.14, Vitest 4.1.12, Linux. This is local validation plus actual host loading; the independent model task remains **blocked**, not passed.

## Reproduce

```sh
bun install --no-save
bun run check
bun run doctor
bun run package:foundry
unzip -t artifacts/usora-foundry-1.5.3.zip
node scripts/skill-portability-demo.ts
node scripts/skill-portability-demo.ts --host --host-timeout-ms 60000
```

Where Bun is absent, these checks were run using `npm exec --yes --package bun@1.3.14 -- bun ...`. The demo also works under Bun. Python 3 is used only by developer acceptance as an independent ZIP reader; installed Foundry remains pure Node >=20.

The repository marketplace checker uses any root `artifacts/usora-foundry-<version>.sha256` as a release override. After local package acceptance, move that ignored checksum to a scratch directory before rerunning `check`; do not regenerate marketplace metadata with an unpublished local checksum.

## Actual results

| Check                                | Result                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline                             | 15 files, 65 tests passed                                                                                                                           |
| Validator unit suite                 | 46 passed                                                                                                                                           |
| Export/ZIP unit suite                | 19 passed                                                                                                                                           |
| MCP integration addition             | 5 passed                                                                                                                                            |
| Full `bun run check`                 | 19 files, **175 passed**, 21.64s; format/lint/type/build/package/runtime/marketplace/doctor passed                                                  |
| Explicit `bun run doctor`            | Canonical/Codex/CodeBuddy/marketplace metadata OK                                                                                                   |
| Actual plugin packaging + `unzip -t` | 12 files OK; archive SHA256 `de518ec84de859ea54c26de99cfa3870e8d306c30050fd2ea212c39e0f1055d0`                                                      |
| Final demo, no model invocation      | Exit 0; real built Node MCP lifecycle, exports and Python verification passed                                                                       |
| Codex 0.163.0 native Skill loader    | `app-server skills/list` passed; repo scope, enabled=true, pluginId=null, correct `.agents/skills/portable-release-notes/SKILL.md`, no parse errors |
| Independent Codex model task         | **Blocked**: proxy CONNECT HTTP403 to `chatgpt.com`; 60s bounded attempt, no successful task output                                                 |
| Independent security retest          | 4/4 passed after both credential-detection/report-leak fixes                                                                                        |
| Native Windows / CodeBuddy host task | Not run; Linux path/UTF-8 ZIP and packaged runtime checks are not substitutes                                                                       |

See [local evidence](evidence-local.json) and [actual host attempt evidence](evidence-host.json). The latter deliberately retains `status: failed` and `independent_host.status: blocked`; loader success is recorded separately. No model task was fabricated or replaced with a scripted expected result.

## Real export

The [fixture](fixture/SKILL.md) is published through a temporary real Hub, with an Activity-backed passing Candidate, Skill evaluation and Maintainer publication. `skill_query`/`skill_get` select it before snapshots. This never modifies a user's existing Hub.

```json
{"name":"skill_validate","arguments":{"skill_id":"portable-release-notes"}}
{"name":"skill_export","arguments":{"skill_id":"portable-release-notes","format":"directory","output_path":"/absolute/existing/export-parent"}}
{"name":"skill_export","arguments":{"skill_id":"portable-release-notes","format":"zip","output_path":"/absolute/existing/export-parent"}}
```

Download the [actual exported ZIP](portable-release-notes.zip). The [fixture directory](fixture) is byte-identical to the actual directory export (both files compared after final build). This small archive is an intentional, reviewable acceptance sample, not a plugin build artifact.

The generated package contains exactly:

```text
portable-release-notes/SKILL.md
portable-release-notes/references/style-guide.md
```

ZIP SHA256: `e00e8e5fa4317be3f5df0afe8c03a8c0d57d82863bbe2182d1b1f89e21d02653`. Repeated ZIP exports are byte-identical. Python stdlib `zipfile` verifies CRC, UTF-8 flags, safe single-root paths, no extra files and byte equality with directory output. The complete host/Knowledge tree digests match before and after validate/export; raw digests and per-file checksums are in the evidence JSON.

The host task reads `changes.json`, loads the extracted Skill plus bundled format guide, and must produce exactly checked `release-notes.json` groups and ordering. Only actual output is accepted. Native loader recognition required no model requests or MCP tool calls. Model execution uses an isolated temp project with no Hub and `--ignore-user-config`; it cannot complete until the environment permits the authenticated model endpoint. The app-server loader itself has no ignore-user-config option, so its evidence explicitly records that it uses installed configuration and makes only local loader RPCs.

## Failures and fixes

Initial `check` failed original plan formatting, then bundled third-party YAML lint warnings, then a local package-checksum override. The plan was formatted, generated bundles/artifacts excluded from source lint/format, and the local release checksum moved out of the override path. Published marketplace metadata was unchanged. Final full check passed.

Final specification retest also found numeric/collection YAML metadata keys being coerced to strings. Two added tests failed before the AST validation fix, then all46 validator tests passed without the collection-key warning.

Unit/review failures found missed PowerShell/environment dependencies, quoted JSON credential assignments, and detected-token leakage through other diagnostics/dependencies. Fixes and focused regression retests passed. Secret failures now return a generic redacted report without untrusted file paths or dependency strings. Independent review repeated the originally failing fixtures and verified serialized reports exclude all supplied secrets.

## Remaining limits

The only outstanding required acceptance is the real independent model task. Allow the authenticated Codex endpoint through the supported environment configuration workflow, then rerun the existing `--host` command. This session exposes no environment-policy mutation tool, and the enforced proxy was not bypassed.

Dependency/secret scanning remains static and conservative. Native Windows/CodeBuddy execution is unverified. Usora uses an ASCII Skill-name subset and three resource directories; arbitrary directories/dynamic references are outside v1. Per-target locks protect cooperating exporters; hostile concurrent local filesystem replacement is outside the documented threat model. No cloud sync, market upload, automatic installation, release or PR merge was performed.

## 2026-10-30 robustness follow-up

Pure content analysis now depends on a neutral protocol-name catalog rather than initializing MCP schemas. The registry checks its completeness/types. All bundled scripts require a known or explicitly unrecognized runtime review; PowerShell/TypeScript/Windows script requirements are no longer omitted. Computed token variables are distinguished from quoted/config credential literals; closed code fences, typed literals and saturated diagnostics retain safe redaction.

Unique reference attempts, dependencies and diagnostics are capped; failed resources are visited once. Input reads use bounded buffers; Markdown scanning and boundary normalization avoid quadratic behavior and preserve meaningful spaces. Malformed-input tests execute real validators in independently killable processes, so synchronous CPU regressions cannot hang Vitest indefinitely.

Export copies validated buffers/report/options before yielding and verifies path/size/hash evidence. Postcommit cleanup failures preserve exported=true with recovery warnings, and cannot erase a primary rollback recovery location. Default ZIP uses atomic no-clobber linking. Subprocess tests prove TERM/KILL escalation, inherited-pipe and output limits. Final local check175/175, actual demo, package/unzip and fixture/ZIP byte comparisons passed. Earlier failed/killed attempts are recorded in the progress log rather than counted as green.

The user is preparing chatgpt.com allowance. Fresh policy remains restricted/enforced at revision2 without that host. No new model task was run while allowance is pending; the preserved host JSON is the prior real blocked attempt, not a successful current task. Stage6 stays unchecked until actual execution and output verification succeed.
