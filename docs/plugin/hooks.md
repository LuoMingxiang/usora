# Hooks: Automatic session activity recording

This page explains the MVP hook implementation that automatically records AI session activity when a host triggers the SessionEnd hook.

What was added

- scripts/session-hook.mjs — a small Node script that reads the SessionEnd event JSON from stdin, extracts session_id, cwd, timestamp, and transcript path (best-effort), and writes a raw activity JSON into `.usora/activities/`.
- hooks/hooks.json — registers a "SessionEnd" command hook that runs the script.
- Updated plugin manifests (`.codex-plugin/plugin.json` and `.codebuddy-plugin/plugin.json`) to reference `./hooks/hooks.json`.

How it works

When the host (CodeBuddy or Codex) triggers a `SessionEnd` command hook, it should invoke the command and provide the event JSON on stdin. The script will write a file named `<session_id>-<timestamp>.activity.json` under `.usora/activities/`.

Local test

Run the following locally to simulate a SessionEnd event (from repo root):

```bash
mkdir -p .usora/activities
echo '{"session_id":"abc123","cwd":"/path/to/repo","timestamp":"2026-08-19T00:00:00Z"}' | node ./scripts/session-hook.mjs
ls -la .usora/activities
cat .usora/activities/abc123-2026-08-19T00-00-00.activity.json
```

Notes and TODOs

- The provided `hooks/hooks.json` uses `${CODEBUDDY_PLUGIN_ROOT}` in the command. To use the same file with Codex, either replace the variable with `${CLAUDE_PLUGIN_ROOT}` or create a small host-specific wrapper in the manifest.
- Current dedupe policy: if a recent activity file for the same `session_id` exists (modified within the last 5 minutes), the script skips writing a new file. This is intentionally conservative to avoid duplicate writes from multiple identical hook firings.
- The script writes a raw activity record (no merging). Future work: call into Usora's existing activity merge logic (activity_capture) to perform dedup/merge.
- Confirm host behavior: whether transcript files are available at SessionEnd, and whether the host passes the event JSON to stdin for command hooks.

If you want, I can (in a follow-up PR):
- add a Codex-specific hooks copy that uses `${CLAUDE_PLUGIN_ROOT}`; or
- integrate the script with activity_capture merge logic; or
- add tests and CI checks.
