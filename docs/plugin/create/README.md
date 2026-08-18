# Plugin Platform Notes

Usora follows a single canonical plugin payload with thin host adapters.

| Host           | Manifest                        | Marketplace                          | MCP config                   |
| :------------- | :------------------------------ | :----------------------------------- | :--------------------------- |
| Community/root | `plugin.json`                   | `marketplace.json`                   | `.mcp.json`                  |
| Codex          | `.codex-plugin/plugin.json`     | `.agents/plugins/marketplace.json`   | `.codex-plugin/mcp.json`     |
| CodeBuddy      | `.codebuddy-plugin/plugin.json` | `.codebuddy-plugin/marketplace.json` | `.codebuddy-plugin/mcp.json` |

## Source of Truth

Edit `plugin.json` first, then run:

```powershell
npm run sync
npm run doctor
```

Generated host metadata should not be hand-edited unless a host-specific field cannot be represented in the root manifest.

## Supported Components

Usora currently ships:

- one Skill directory under `skills/`;
- one local MCP server entrypoint under `scripts/usora-mcp.mjs`;
- host-specific MCP config files.

Usora intentionally does not ship `commands`, `agents`, `hooks`, workflows, dashboards, or cloud services in the MVP.
