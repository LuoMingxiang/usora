# Plugin Platform Notes

Usora is a marketplace monorepo with one canonical plugin payload per plugin.

| Host           | Manifest                                        | Marketplace                          | MCP config                                   |
| :------------- | :---------------------------------------------- | :----------------------------------- | :------------------------------------------- |
| Community/root | `plugins/foundry/plugin.json`                   | `marketplace.json`                   | `plugins/foundry/.mcp.json`                  |
| Codex          | `plugins/foundry/.codex-plugin/plugin.json`     | `.agents/plugins/marketplace.json`   | `plugins/foundry/.mcp.json`                  |
| Claude         | `plugins/foundry/plugin.json`                   | `.claude-plugin/marketplace.json`    | `plugins/foundry/.mcp.json`                  |
| CodeBuddy      | `plugins/foundry/.codebuddy-plugin/plugin.json` | `.codebuddy-plugin/marketplace.json` | `plugins/foundry/.codebuddy-plugin/mcp.json` |

## Source of Truth

Edit `plugins/foundry/plugin.json` first, then run:

```powershell
bun run sync
bun run doctor
```

Generated host metadata should not be hand-edited unless a host-specific field cannot be represented in the root manifest.

## Supported Components

Usora currently ships:

- one Skill directory under `plugins/foundry/skills/`;
- one local MCP server entrypoint under `plugins/foundry/scripts/usora-mcp.mjs`;
- host-specific MCP config files.

Usora intentionally does not ship `commands`, `agents`, `hooks`, workflows, dashboards, or cloud services in the MVP.
