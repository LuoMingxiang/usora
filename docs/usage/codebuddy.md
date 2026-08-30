# CodeBuddy Usage

## Install

```powershell
codebuddy plugin marketplace add https://github.com/LuoMingxiang/usora.git
codebuddy plugin install usora@foundry
```

For local development:

```powershell
codebuddy --plugin-dir plugins/foundry
```

Usora Foundry is loaded through `plugins/foundry/.codebuddy-plugin/plugin.json`, which points to `.codebuddy-plugin/mcp.json`.
The MCP config starts:

```json
{
  "mcpServers": {
    "practice": {
      "command": "node",
      "args": ["${CODEBUDDY_PLUGIN_ROOT}/dist/mcp.js"]
    }
  }
}
```

`CODEBUDDY_PLUGIN_ROOT` must resolve to the installed Usora plugin root. Without it, CodeBuddy may resolve `dist/mcp.js` relative to VS Code's install directory and fail with `MODULE_NOT_FOUND`.

CodeBuddy may clone marketplace sources under `~/.codebuddy/plugins/marketplaces`. That is fine. Usora stores Hub data in `~/.codebuddy/plugins/data/usora/.usora`, so upgrades do not clear the Hub and Usora does not create Hub data in the current project.

## Try

```text
Initialize my Usora Skill Hub
Show Usora status
Capture this session into Usora
```

## Upgrade

Usora's CodeBuddy marketplace can be added from GitHub `master`, but the Foundry plugin payload points to the generated `marketplace` branch. Local changes only become installable after the release flow publishes that distribution branch.

```powershell
git push origin master
codebuddy plugin update usora@foundry
```

The Release workflow runs the plugin-aware release scripts, syncs plugin metadata, and tags the release before the update.

## Cache Cleanup

```text
Clean old Usora plugin cache
```

The tool starts with a dry run. Confirm deletion only after it lists the old versions you expect.
