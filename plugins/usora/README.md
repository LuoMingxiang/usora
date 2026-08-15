# Usora

Usora is a local-first Personal Skill Hub for AI. It stores structured work Activities, turns repeated patterns into Candidates, and maintains reusable Skills.

## Quick start

Use the Usora MCP tools from Codex. No Python or separate CLI installation is required.

The default Hub is `~/.usora`, or set `USORA_HOME` to use a project-local directory.

The MCP server initializes the Hub lazily, captures real Activities, records Candidates and evaluations, and publishes versioned Skills only through the configured Maintainer.

## Design boundary

The plugin owns storage, lifecycle, roles, and state progression. AI-specific integrations should normalize sessions into Activities and must not implement Skill business logic.
