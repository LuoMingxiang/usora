---
name: usora-skill-hub
description: "Operate Usora: initialize storage, record Activities, discover Candidates, configure the Maintainer, evaluate/publish Skills, inspect status, and clean up processed data."
---

# Usora

Use the Usora MCP tools for all Hub mutations. In a workspace containing the Usora `AGENTS.md`, behave as always-on: do not wait for an explicit Skill invocation. Do not ask the user to install Python or run a CLI.

Maintain one Activity per AI session. After substantive progress, call `activity_capture`; pass `session_id` when the host provides a stable one, otherwise the MCP server uses a process-scoped ID formatted as `session-{timestamp_hex}-{128_bit_random_salt}`. Repeated calls must update the same record with key points, decisions, approach, and result. Never capture a full transcript and never invent an Activity.

## Natural-language mapping

- “Initialize my Skill Hub” → run the mandatory Initialization walkthrough below, then MCP tool `hub_init` (with `path`) and `hub_config`
- “Configure my Maintainer or automation policy” → MCP tool `hub_config`
- “Show my Skill Hub status” → MCP tool `hub_status` (reports the resolved data directory and config path)
- “Where is my Usora data stored?” → MCP tool `hub_status`, then tell the user the `hub` and `config_path` fields
- “Clean up generated Activities” → MCP tool `hub_cleanup` with `mode: generated`
- “Clean everything” → MCP tool `hub_cleanup` with `mode: all, confirm: true` (deletes all Hub data but keeps the data directory and config)
- “Capture this task” → MCP tool `activity_capture`
- “Create a Candidate” → MCP tool `candidate_create`
- “Evaluate this Candidate” → MCP tool `candidate_evaluate`
- “Publish this Skill” → MCP tool `skill_publish`
- “Create a Skill draft” → MCP tool `skill_create`
- “Evaluate this Skill” → MCP tool `skill_evaluate`
- “Capture this task” → Usora MCP tool `activity_capture`

## Initialization (mandatory interaction)

Initialization is a guided, interactive walkthrough. You MUST ask the user and wait for their answers before calling any tool. Never initialize silently or assume defaults without explicit confirmation.

Ask the user, in order:

1. **Data directory** — where should the Hub data live? Offer a sensible default (e.g. the active workspace's `.usora`) so the user can accept it with one reply, but require an explicit answer. Accept an absolute path or a path relative to the workspace.
2. **Maintainer** — which AI/agent is the Primary Maintainer (e.g. `codex`, `claude-code`, `codebuddy`)? Offer the current default and require confirmation.
3. **Automation policy** — one of `auto_publish`, `manual_approval`, or `auto_generate_manual_publish`. Explain each briefly and require a choice.

Only after the user has answered all three, perform initialization:

1. Call `hub_init` with `path` set to the chosen directory. The choice is persisted in `config.hub_path`, so every later operation resolves to it automatically.
2. Call `hub_config` with the chosen `maintainer` and `automation_policy`.
3. Confirm back to the user: the resolved data directory (`hub`), the config path (`config_path`), the Maintainer, and the automation policy.

If the user wants to skip a question, only skip it if they explicitly say so; otherwise keep asking. If the Hub is already initialized, ask whether to keep the existing location or relocate, and re-confirm the Maintainer and policy before changing anything.

## Uninstalling / cleanup behavior

The plugin host (e.g. Codex) removes the plugin itself; Usora does not delete data on uninstall. To help the user fully clean up:

1. Call `hub_status` and tell the user where their data lives (`hub`) and where the config file is (`config_path`).
2. On request, clear the data with `hub_cleanup` `mode: all, confirm: true` — this empties all records/Skills/events but keeps the data directory and config, so the path remains discoverable.
3. Inform the user that the (now empty) data directory itself can be removed manually if they no longer want it.

Always preserve the boundary: Workers and Reviewers may contribute Activities and Candidates; only the configured Maintainer publishes Skills. Do not load the entire Activity history into context. Use `status`, recent records, and targeted IDs.

## Normalized Activity

Record task, context, key_points, approach, result, technologies, outcome, source, and session/project metadata. One session must map to one Activity file; use updates/key_points to preserve evolution across the session.

## Sync behavior

Use MCP tools for initialization, Activity capture, Candidate review, and publication. Initialization is interactive: it must follow the mandatory walkthrough above (directory, Maintainer, automation policy) before creating the Hub. The default data location is the active workspace's `.usora`; set `USORA_HOME` to share one Hub across workspaces. Initialization never creates sample data.

Candidates can be explicitly evaluated before publication. Publishing updates the single current Skill in place and records its `revision`, Maintainer, and publication time; do not create version directories.
