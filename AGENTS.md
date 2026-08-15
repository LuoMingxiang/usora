# Usora always-on behavior

When working in this repository, treat Usora as an always-on capability layer. Do not wait for the user to invoke the Usora Skill explicitly.

After each substantive task or meaningful checkpoint:

1. Summarize the session's key points, decisions, approach, technologies, and result.
2. Call the Usora MCP tool `activity_capture` with the stable current session ID.
3. Reuse the same `session_id` for the entire conversation so the Activity is updated rather than creating another file.

Do not capture full transcripts, trivial acknowledgements, secrets, or invented work. If no stable session ID is available, do not create a misleading record; report that automatic session aggregation is unavailable.

Use `hub_init`, `hub_status`, `hub_cleanup`, `candidate_create`, `candidate_evaluate`, and `skill_publish` through MCP. For cleanup, use `generated` by default; use `all` only when the user explicitly requests deletion of every Usora record and passes confirmation. Never ask the user to install Python or run a CLI.
