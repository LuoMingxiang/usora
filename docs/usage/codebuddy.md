# CodeBuddy Usage

## Install

```powershell
codebuddy plugin marketplace add https://github.com/LuoMingxiang/usora.git
codebuddy plugin install usora@usora
```

For local development:

```powershell
codebuddy --plugin-dir .
```

Usora is loaded through `.codebuddy-plugin/plugin.json`, which points to `.codebuddy-plugin/mcp.json`.
The MCP config starts:

```json
{
  "mcpServers": {
    "usora": {
      "command": "node",
      "args": ["${CODEBUDDY_PLUGIN_ROOT}/scripts/usora-mcp.mjs"]
    }
  }
}
```

`CODEBUDDY_PLUGIN_ROOT` must resolve to the installed Usora plugin root. Without it, CodeBuddy may resolve `scripts/usora-mcp.mjs` relative to VS Code's install directory and fail with `MODULE_NOT_FOUND`.

CodeBuddy may clone marketplace sources under `~/.codebuddy/plugins/marketplaces`. That is fine. Usora stores Hub data in `CODEBUDDY_PLUGIN_DATA` when available, otherwise `~/.codebuddy/plugins/data/usora/.usora`, so it does not create Hub data in the current project.

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
codebuddy plugin update usora@usora
```

## Cache Cleanup

```powershell
./scripts/cleanup-usora-plugin-cache.ps1 -HostName codebuddy
./scripts/cleanup-usora-plugin-cache.ps1 -HostName codebuddy -Apply
```

The first command is a dry run.
