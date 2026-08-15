---
name: usora-skill-hub
description: "Operate the Usora local-first Personal Skill Hub: initialize storage, record Activities, discover Candidates, configure the Maintainer, evaluate/publish Skills, inspect status, and clean up processed data."
---

# Usora Skill Hub

Use the Usora MCP tools for all Hub mutations. Do not ask the user to install Python or run a CLI.

After completing a substantive user task, capture one concise Activity with `activity_capture`, including task, approach, result, technologies, and outcome. Never capture a full transcript and never invent an Activity.

## Natural-language mapping

- “Initialize my Skill Hub” → MCP tool `hub_init`
- “Show my Skill Hub status” → MCP tool `hub_status`
- “Capture this task” → MCP tool `activity_capture`
- “Create a Candidate” → MCP tool `candidate_create`
- “Evaluate this Candidate” → MCP tool `candidate_evaluate`
- “Publish this Skill” → MCP tool `skill_publish`
- “Capture this task” → Usora MCP tool `activity_capture`

Always preserve the boundary: Workers and Reviewers may contribute Activities and Candidates; only the configured Maintainer publishes Skills. Do not load the entire Activity history into context. Use `status`, recent records, and targeted IDs.

## Normalized Activity

Record task, context, approach, result, technologies, outcome, source, and session/project metadata. Do not store a full transcript when a concise structured record is sufficient.

## Sync behavior

Use MCP tools for initialization, Activity capture, Candidate review, and publication. The Hub is created lazily under `~/.usora`; initialization never creates sample data.

Candidates can be explicitly evaluated before publication. Publishing increments the patch version and records the Maintainer and publication time.
