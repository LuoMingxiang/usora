# Export portable Agent Skills

Use `skill_query` to find a published Skill and `skill_get` to inspect only that Skill. Publication remains an internal Maintainer decision. Validation and export take read-only snapshots and never publish, evolve, migrate or install a Skill.

```json
{"name":"skill_query","arguments":{"state":"PUBLISHED","q":"release","limit":3}}
{"name":"skill_get","arguments":{"name":"portable-release-notes"}}
{"name":"skill_validate","arguments":{"skill_id":"portable-release-notes"}}
{"name":"skill_export","arguments":{"skill_id":"portable-release-notes","format":"directory","output_path":"/absolute/existing/exports","dry_run":true}}
{"name":"skill_export","arguments":{"skill_id":"portable-release-notes","format":"directory","output_path":"/absolute/existing/exports"}}
{"name":"skill_export","arguments":{"skill_id":"portable-release-notes","format":"zip","output_path":"/absolute/existing/exports"}}
```

Both new tools require `skill_id`, the existing directory/name used by `skill_get`. The export parent must already exist and be outside Usora data and plugin/source trees. `format` defaults to `directory`; `dry_run` defaults to false; `conflict` defaults to `error`. To replace only the exact Skill directory or ZIP, explicitly pass `"conflict":"overwrite"`. Dry run validates and previews without writing. No empty resource directories are emitted.

If the artifact was committed but temporary cleanup failed, the result still reports `exported: true`, with `EXPORT_CLEANUP_FAILED` in warnings and a `recovery` object listing remaining paths. Check the reported artifact before retrying. A retained lock is never stolen automatically; remove it only after confirming the prior export process has stopped. Default ZIP conflict protection requires hard-link support in the export filesystem; unsupported filesystems fail safely instead of overwriting another file.

```text
exports/
  portable-release-notes/
    SKILL.md
    references/                 # only when referenced
      release-format.md
  portable-release-notes.zip     # same one-root directory structure
```

Validation returns `valid`, `errors`, `warnings`, `files` (path, bytes, SHA256), `dependencies` and `compatibility`. Export adds `exported`, `dry_run`, `target`, `format` and the ZIP checksum when applicable. A failed validation exports nothing. Diagnostics include actionable codes and file paths without echoing detected credential values.

If the source has no frontmatter, export renders `name` and `description` from its metadata. Existing frontmatter is validated, not silently repaired. The original Markdown, metadata, revision, state, indexes, events and usage remain unchanged. Names must fit Usora's ASCII storage subset of the Agent Skills specification. Resources support UTF-8 filenames, including Chinese and spaces. Text must be valid UTF-8; generated Markdown uses LF.

Static resource collection is restricted to `scripts/`, `references/` and `assets/`. Referenced files must exist, stay within the Skill, and have no symlink ancestors. Path traversal, drive/UNC paths, credentials and unsafe configuration files are rejected. Limits are 100 files, 1 MiB per file and 16 MiB total. Only collected resources are packaged; private `skill.json`, Hub records and unreferenced files are excluded. See the [contract](../plans/skill-portability-v1-design.md) for the precise scope and filesystem threat model.

Static analysis also caps unique references, dependencies and diagnostics at 100 entries, including external and failed references. `ANALYSIS_LIMIT` rejects an incomplete analysis; it never silently truncates the report and claims independence. Repeated references are deduplicated. Meaningful Markdown indentation and trailing spaces survive rendering; only boundary newlines are normalized.

`compatibility.independent` is static eligibility, not proof that a host executed the Skill. Required Usora/MCP tools, runtimes, OS commands, credentials, dynamic resources or external services are reported as dependencies. Every bundled script requires a runtime review; an unrecognized extension is reported explicitly instead of being assumed independent. A structurally valid package can still require provisioning. Review warnings and run a concrete task in the target host before sharing. `allowed-tools` is experimental and does not grant permission across hosts.

For a reproducible developer demo, build first and run:

```sh
bun run build:foundry
bun scripts/skill-portability-demo.ts
# Also run a real isolated Codex task (requires an authenticated Codex CLI):
bun scripts/skill-portability-demo.ts --host
```

The demo uses a temporary Hub, publishes a reviewed example, validates, exports both formats, extracts with Python's independent ZIP reader, compares file contents and source hashes, and optionally invokes Codex with user configuration disabled. It saves artifacts under ignored `artifacts/skill-portability/`; it never touches the user's Hub. Python is a developer acceptance tool, not a requirement for installed Foundry. See [recorded acceptance evidence](../examples/skill-portability/acceptance.md).

Troubleshooting:

- Missing Hub/Skill: initialize through ordinary `hub_init`, or check `USORA_HOME` before starting MCP. Export never initializes storage.
- Legacy schema: use the existing explicit migration workflow, including dry run and confirmation; validation does not migrate.
- Draft/rejected/retired Skill: finish ordinary review and Maintainer publication first.
- Invalid metadata: correct the source through the normal Skill workflow. Export does not rename records or invent a description.
- Missing/unsafe resource or credential: repair/remove the reference or sensitive content, evaluate the changed Skill and retry validation.
- Existing target: choose another export parent, or explicitly overwrite the exact target after reviewing the preview.

# 导出可移植 Agent Skills

先用 `skill_query` 查询已发布 Skill，再用 `skill_get` 读取目标内容，按上面的 JSON 示例调用 `skill_validate` 和 `skill_export`。新工具使用 `skill_id`（现有 Skill 名称），只读校验已发布内容，不修改审核、revision、事件或 Hub 数据，也不自动发布或安装。

`output_path` 必须是已存在的绝对路径父目录，并位于 Usora 数据及插件/源码目录之外。默认不覆盖；`dry_run:true` 只预览；需要替换时显式使用 `conflict:"overwrite"`，仅作用于目标 Skill 目录或 ZIP。校验失败时不写产物。

阅读返回的 `errors`、`warnings`、`files`、`dependencies` 和 `compatibility`。`independent` 仅表示静态分析具备独立运行条件，不表示已在所有宿主执行。依赖 Foundry MCP、其他 MCP、解释器、外部服务、凭据或特定平台时会报告限制。宿主对 `allowed-tools` 等可选字段的支持可能不同。

源 Skill 没有 frontmatter 时，导出使用元数据生成；已有 YAML 无效时直接报告。仅收集白名单目录内的静态引用资源，拒绝越界路径、符号链接、敏感配置和疑似明文凭据。支持中文与空格资源名和 UTF-8 ZIP。当前 Linux 验收不能视为 Windows 原生执行或 CodeBuddy 实际加载验证。

开发者可运行上述演示命令复现完整链路；`--host` 会额外在没有 Usora Hub/MCP 的临时项目中执行真实 Codex 任务。实际结果及限制见[验收记录](../examples/skill-portability/acceptance.md)。本期不提供市场上传、云同步、自动安装或赛事适配。

补充健壮性说明：静态引用、依赖和诊断各限制100项，包含外链与失败引用；超限返回 ANALYSIS_LIMIT 并拒绝导出。导出保留正文中有意义的缩进和行尾空格。若产物已提交而临时清理失败，仍返回 exported:true，并通过 EXPORT_CLEANUP_FAILED 与 recovery 提供剩余路径；先检查产物，再决定重试。仅在确认旧导出进程已停止后清理残留锁，工具不会自动抢锁。默认 ZIP 防覆盖需要输出文件系统支持硬链接；不支持时安全失败，可选择支持的本地文件系统或目录格式。
