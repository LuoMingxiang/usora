# Skill Portability v1 — contract and design

## Boundaries and source

Publish is Maintainer-controlled internal state. Export is a read-only snapshot of one explicitly selected PUBLISHED Hub Skill. Distribution to external services is outside scope. No draft export, migration, publication, index rebuild, event or telemetry writes occur. The new handlers bypass `ensure()` and read existing config/Knowledge paths without legacy auto-migration. v1 config is rejected with a migration diagnostic; unknown/no Hub, missing/corrupt Skill and nonpublished states are reported. No schema or plugin version change is needed.

`skill_id` is the existing Skill directory name, not a new identifier. Names remain untouched; incompatible existing names fail portable validation. Usora supports the existing ASCII storage-name subset; Unicode resource filenames are supported. Official spec source and exact revision are in the audit.

## MCP contract

```json
{"name":"skill_validate","arguments":{"skill_id":"portable-demo"}}
{"name":"skill_export","arguments":{"skill_id":"portable-demo","format":"directory","output_path":"/absolute/existing/export-root","conflict":"error","dry_run":true}}
{"name":"skill_export","arguments":{"skill_id":"portable-demo","format":"zip","output_path":"/absolute/existing/export-root","conflict":"error","dry_run":false}}
```

`format` defaults to directory; `conflict` defaults to error (alternative overwrite); dry_run defaults false. `output_path` is an existing absolute export parent, final target is `<parent>/<skill-name>` or `<parent>/<skill-name>.zip`. Only that target can be replaced. Overwrite is explicit and does not alter Hub permission decisions. Export is available to readers of published data; no actor can use it to publish or bypass evaluation. Validate has no filesystem output.

Validation returns `valid`, structured `errors`/`warnings` (`code`, `message`, optional file), `files` (relative path, bytes, SHA256), `dependencies`, and `compatibility` (Agent Skills validity, independent eligibility and notes). Export returns the same report plus `exported`, `dry_run`, target and format, and artifact SHA256 for ZIP. Validation/security failure writes nothing. Dependency reports appear in the result, not hidden lifecycle metadata in the Skill package. Argument/path/conflict failures use stable error-code prefixes in the existing JSON-RPC error envelope.

## Pipeline

1. Strictly read config, selected `skill.json` and `SKILL.md`; require PUBLISHED and a passing evaluation. Read twice, compare full snapshots and reject unstable input after bounded retries. Do not reuse index queries or mutate the source.
2. Parse existing YAML with a maintained parser that rejects duplicate keys, aliases/custom tags and malformed data. If frontmatter is absent, render name/description from metadata; if present, validate it rather than repairing it silently. Normalize only generated Markdown UTF-8/LF; require nonempty body as Usora's usability gate. Support the standard optional license, compatibility, metadata and experimental allowed-tools fields. Optional host differences produce warnings, not invented profiles.
3. Collect static root-relative references under scripts/references/assets, recursively follow references with a visited set and flag cycles. Reject missing files, remote resource links as required local assets, traversal, encoded escape, Windows drive/UNC/backslash paths and symlinks. Do not package arbitrary `skill.json`, Hub history or unrelated files. Detect secrets in text and binaries before output; reject likely tokens, private keys and sensitive config names. Bounds: 100 files, 1 MiB per file, 16 MiB total; reject unsupported encodings/special files. Report bounds and unsupported dynamic references.
4. Scan prose and scripts for Usora tools, MCP use, interpreter/package runtimes, platform commands, external services and environment credentials. `valid` means structurally exportable, not executable on every host. A required external/Usora/platform/runtime dependency makes independence unavailable without provisioning; static independence is explicitly an eligibility assessment, never proof of execution.
5. Stage immutable file buffers in a sibling temporary directory/file. Output parent and ancestors must be existing real directories without symlinks. Reject overlap with host/Knowledge data or plugin source/install roots. Use a per-target exclusive export lock, recheck conflicts before commit, replace only the exact target with rollback for explicit overwrite, clean staging/locks on failure. Threat model is cooperating local processes; hostile concurrent filesystem mutation requires OS-level sandboxing and is not claimed solved.
6. Reuse the repository's ZIP32 STORE/CRC32 implementation in a small pure Node shared helper. Sort by codepoint, fixed DOS timestamp, UTF-8 filename bit, normalized forward slashes, validate entry uniqueness/paths and ZIP32 bounds; preserve executable file modes. No shell ZIP invocation or Bun runtime API. ZIP includes exactly one Skill root; no empty directories. Verify with an independent ZIP reader.

## Representation and modules

- `plugins/foundry/src/core/portability/types.ts`: Diagnostic, Dependency, ValidationResult, SkillSnapshot and buffered files.
- `.../portability/validate.ts`: snapshot reader, renderer, resource validation, dependency/security analysis; exported `validateSkillSnapshot(skillId)` returns `{report, snapshot}` (snapshot null on failure).
- `.../portability/export.ts`: `exportSkillSnapshot(snapshot, report, args)` commits validated buffers and returns artifact evidence. Validation reports cannot be bypassed by MCP arguments.
- `.../core/skill-portability.ts`: public `handleSkillValidate` and `handleSkillExport` argument checks/orchestration.
- `packages/shared/src/zip.ts`: reusable deterministic ZIP writer used by exporter and plugin packager.

## Compatibility and failure behavior

| Situation                                    | Behavior                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| Existing generated Markdown                  | Frontmatter rendered from valid name/description; original untouched             |
| Invalid supplied YAML/name/empty description | Structured rejection; fix source through ordinary review workflow                |
| No Hub, v1, Draft, missing resource          | Actionable diagnostic; no implicit setup or migration                            |
| Usora MCP or external runtime needed         | Dependency report; no claim of independent execution                             |
| Existing output                              | Error by default; dry run reports conflict; explicit overwrite exact target only |
| Chinese/space resource names                 | UTF-8 filenames and ZIP flag; preserve resource bytes                            |
| Windows-style unsafe path                    | Reject on every OS; native Windows execution remains unverified on Linux         |
| Codex/CodeBuddy plugin                       | Same manifests, hook and Node bundle contracts; packaged clean-runtime checks    |

## Acceptance

Unit tests cover YAML, naming, resources, dependencies, secrets, limits, paths, cycles and ZIP. MCP tests exercise Candidate→Draft→Evaluate→Publish→Validate→directory→ZIP, hash the source tree before/after, test failures and overwrite rollback. The demo exports an instruction-only self-contained Skill, unzips in a temp project without Hub/MCP, loads it in installed Codex 0.163.0 and verifies a concrete output. Record host evidence and limits honestly; no CodeBuddy/native Windows claim without execution.
