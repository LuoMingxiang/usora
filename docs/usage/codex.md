# Codex Usage

## Install

```powershell
codex plugin marketplace add https://github.com/LuoMingxiang/usora.git
codex plugin add usora@usora
```

Usora is loaded through `.codex-plugin/plugin.json`, which points to `.codex-plugin/mcp.json`.
The MCP config starts:

```json
{
  "mcpServers": {
    "usora": {
      "command": "node",
      "args": ["${PLUGIN_ROOT}/scripts/usora-mcp.mjs"]
    }
  }
}
```

## Try

```text
Initialize my Usora Skill Hub
Show Usora status
Capture this session into Usora
```

## Upgrade

Usora's marketplace entry points to GitHub `master`. Local changes only become installable after commit and push.

```powershell
./scripts/release-usora-plugin.ps1 -Commit -Push
```

Then upgrade Usora in `/plugins`. If the UI says upgrade failed but the version changed, open a new task and check whether the expected Usora tools are available.

## Cache Cleanup

```text
Clean old Usora plugin cache
```

Developer fallback:

```powershell
./scripts/cleanup-usora-plugin-cache.ps1 -HostName codex
./scripts/cleanup-usora-plugin-cache.ps1 -HostName codex -Apply
```

The first command is a dry run.
