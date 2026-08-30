<p align="center">
  <a href="hooks.md">English</a> ·
  <a href="hooks.zh-CN.md">中文</a>
</p>

# Hooks: Automatic session activity recording

This page explains the MVP hook implementation that records AI session activity when a host triggers `SessionEnd`.

What was added

- `dist/session-hook.js` reads the SessionEnd event JSON from stdin, extracts session metadata best-effort, and records it through Usora's canonical Activity pipeline.
- `hooks/codebuddy-hooks.json` registers the CodeBuddy command hook with `${CODEBUDDY_PLUGIN_ROOT}`.
- `hooks/codex-hooks.json` registers the Codex command hook with `${CLAUDE_PLUGIN_ROOT}`.
- `.codex-plugin/plugin.json` and `.codebuddy-plugin/plugin.json` point at their host-specific hook files.

How it works

When CodeBuddy or Codex triggers `SessionEnd`, the host invokes `dist/session-hook.js` and provides the event JSON on stdin. The script reuses the existing Activity merge logic, so repeated events for the same `session_id` update one Activity in the configured Hub.

Local test

Run the following from the repo root:

```bash
echo '{"session_id":"abc123","cwd":"/path/to/repo","timestamp":"2026-08-19T00:00:00Z"}' | node plugins/foundry/dist/session-hook.js
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hub_status","arguments":{}}}' | node plugins/foundry/dist/mcp.js
```

Notes

- SessionEnd events may not include `task` or `result`; hook-created Activities can start with those fields empty and be enriched later.
- Invalid timestamps fall back to the current time.
- The hook respects the configured Hub path instead of writing to the current project's `.usora/activities` directly.
