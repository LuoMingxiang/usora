---
name: usora-skill-hub
description: "Operate Usora: initialize storage, record Activities, discover Candidates, configure the Maintainer, evaluate/publish Skills, inspect status, and clean up processed data."
---

# Usora

Use the Usora MCP tools for all Hub mutations. In a workspace containing the Usora `AGENTS.md`, behave as always-on: do not wait for an explicit Skill invocation. Do not ask the user to install Python or run a CLI.

Maintain one Activity per AI session. After substantive progress, call `activity_capture`; pass `session_id` when the host provides a stable one, otherwise the MCP server uses a process-scoped ID formatted as `session-{timestamp_hex}-{128_bit_random_salt}`. Repeated calls must update the same record with key points, decisions, approach, and result. Never capture a full transcript and never invent an Activity.

## Natural-language mapping

- “Initialize my Skill Hub” → MCP tool `hub_init` (creates the Hub under the default `<cwd>/.usora`, or the previously relocated directory)
- “Configure my Maintainer or automation policy” → MCP tool `hub_config`
- “Move/relocate my Usora data to `<path>`” → MCP tool `hub_config` with `path` (moves existing data and clears the old directory)
- “Show my Skill Hub status” → MCP tool `hub_status`, then present the canonical status summary below
- “Where is my Usora data stored?” → MCP tool `hub_status`, then tell the user the `hub` and `config_path` fields
- “Check my Skill Hub health” → MCP tool `hub_doctor`
- “Clean up generated Activities” → MCP tool `hub_cleanup` with `mode: generated`
- “Clean everything” → MCP tool `hub_cleanup` with `mode: all, confirm: true` (deletes all Hub data but keeps the data directory and config)
- “Clean old Usora plugin cache” → MCP tool `plugin_cache_cleanup` (dry run by default; pass `confirm: true` to delete old installed plugin versions)
- “Capture this task” → MCP tool `activity_capture`
- “Show recent Activities” → MCP tool `activity_list`
- “Create a Candidate” → MCP tool `candidate_create`
- “Show recent Candidates” → MCP tool `candidate_list`
- “Evaluate this Candidate” → MCP tool `candidate_evaluate`
- “Publish this Skill” → MCP tool `skill_publish`
- “Create a Skill draft” → MCP tool `skill_create`
- “Evaluate this Skill” → MCP tool `skill_evaluate`
- “Show recent Skills” → MCP tool `skill_list`
- “Show this Skill” → MCP tool `skill_read`
- “Show recent Usora events” → MCP tool `event_list`
- “Capture this task” → Usora MCP tool `activity_capture`

## Initialization

Initialization is simple: call `hub_init` (no `path`). It creates the Hub under the default directory `<cwd>/.usora`, or under the directory the user previously relocated to. Never create sample data. Optionally pass `maintainer`/`automation_policy` to set them at the same time.

## Status summary

When reporting `hub_status`, use this stable human-readable order:

```text
Usora Hub
Status: initialized
Data: <hub>
Config: <config_path>
Maintainer: <config.maintainer>
Policy: <config.automation_policy>

Records
Activities: <activities>
Candidates: <candidates>
Skills: <skills>

Next useful action: <next_action label>
```

Map `next_action` to labels as follows:

- `capture_activity` -> `Capture this session`
- `create_candidate` -> `Create a Candidate`
- `create_skill` -> `Create a Skill draft`
- `review_or_cleanup` -> `Review Skills or clean processed Activities`

If the installed MCP server does not return `next_action` yet, infer it from counts without loading records:

- `activities === 0` -> `capture_activity`
- `candidates === 0` -> `create_candidate`
- `skills === 0` -> `create_skill`
- otherwise -> `review_or_cleanup`

## Relocating data

When the user wants to move their data to a different directory, call `hub_config` with `path` set to the new directory (absolute or relative to the workspace). This MOVES all existing records (activities, candidates, skills, archive, events) into the new directory and clears the old directory, then persists the new location in `config.hub_path`. Confirm back the `hub`, `moved_from`, and `config_path` from the result. The `USORA_HOME` environment variable is not used.

## Uninstalling / cleanup behavior

The plugin host (e.g. Codex) removes the plugin itself; Usora does not delete data on uninstall. To help the user fully clean up:

1. Call `hub_status` and tell the user where their data lives (`hub`) and where the config file is (`config_path`).
2. On request, clear the data with `hub_cleanup` `mode: all, confirm: true` — this empties all records/Skills/events but keeps the data directory and config, so the path remains discoverable.
3. Inform the user that the (now empty) data directory itself can be removed manually if they no longer want it.

Always preserve the boundary: Workers and Reviewers may contribute Activities and Candidates; only the configured Maintainer publishes Skills. Do not load the entire Activity history into context. Use `status`, recent records, and targeted IDs.

## Normalized Activity

Record task, context, key_points, approach, result, technologies, outcome, source, and session/project metadata. One session must map to one Activity file; use updates/key_points to preserve evolution across the session.

## Sync behavior

Use MCP tools for initialization, Activity capture, Candidate review, and publication. Initialization uses the default `<cwd>/.usora` directory (or the directory the user relocated to); the `USORA_HOME` environment variable is not used. Initialization never creates sample data.

Candidates can be explicitly evaluated before publication. Publishing updates the single current Skill in place and records its `revision`, Maintainer, and publication time; do not create version directories.
