---
name: usora-skill-hub
description: "Operate Usora: initialize storage, record Activities, discover Candidates, configure the Maintainer, evaluate/publish Skills, inspect status, and clean up processed data."
---

# Usora

Use the Usora MCP tools for all Hub mutations. In a workspace containing the Usora `AGENTS.md`, behave as always-on: do not wait for an explicit Skill invocation. Do not ask the user to install Python or run a CLI.

Maintain one Activity per AI session. After substantive progress, call `activity_capture`; pass `session_id` when the host provides a stable one, otherwise the MCP server uses a process-scoped ID formatted as `session-{timestamp_hex}-{128_bit_random_salt}`. Repeated calls must update the same record with key points, decisions, approach, and result. Never capture a full transcript and never invent an Activity.

## Natural-language mapping

- “Initialize my Skill Hub” → MCP tool `hub_init`
- “Configure my Maintainer or automation policy” → MCP tool `hub_config`
- “Show my Skill Hub status” → MCP tool `hub_status`
- “Clean up generated Activities” → MCP tool `hub_cleanup` with `mode: generated`
- “Clean everything” → MCP tool `hub_cleanup` with `mode: all, confirm: true` (deletes all Hub data)
- “Capture this task” → MCP tool `activity_capture`
- “Create a Candidate” → MCP tool `candidate_create`
- “Evaluate this Candidate” → MCP tool `candidate_evaluate`
- “Publish this Skill” → MCP tool `skill_publish`
- “Create a Skill draft” → MCP tool `skill_create`
- “Evaluate this Skill” → MCP tool `skill_evaluate`
- “Capture this task” → Usora MCP tool `activity_capture`

Always preserve the boundary: Workers and Reviewers may contribute Activities and Candidates; only the configured Maintainer publishes Skills. Do not load the entire Activity history into context. Use `status`, recent records, and targeted IDs.

## Normalized Activity

Record task, context, key_points, approach, result, technologies, outcome, source, and session/project metadata. One session must map to one Activity file; use updates/key_points to preserve evolution across the session.

## Sync behavior

Use MCP tools for initialization, Activity capture, Candidate review, and publication. The Hub is created lazily under the active workspace's `.usora`; set `USORA_HOME` to share one Hub across workspaces. Initialization never creates sample data.

Candidates can be explicitly evaluated before publication. Publishing updates the single current Skill in place and records its `revision`, Maintainer, and publication time; do not create version directories.
