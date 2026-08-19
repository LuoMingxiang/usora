# 插件平台说明

Usora 是 marketplace monorepo，每个插件有一个 canonical plugin payload。

| 宿主           | Manifest                                        | Marketplace                          | MCP 配置                                     |
| :------------- | :---------------------------------------------- | :----------------------------------- | :------------------------------------------- |
| Community/root | `plugins/foundry/plugin.json`                   | `marketplace.json`                   | `plugins/foundry/.mcp.json`                  |
| Codex          | `plugins/foundry/.codex-plugin/plugin.json`     | `.agents/plugins/marketplace.json`   | `plugins/foundry/.mcp.json`                  |
| Claude         | `plugins/foundry/plugin.json`                   | `.claude-plugin/marketplace.json`    | `plugins/foundry/.mcp.json`                  |
| CodeBuddy      | `plugins/foundry/.codebuddy-plugin/plugin.json` | `.codebuddy-plugin/marketplace.json` | `plugins/foundry/.codebuddy-plugin/mcp.json` |

## 单一事实源

优先编辑 `plugins/foundry/plugin.json`，然后运行：

```powershell
bun run sync
bun run doctor
```

生成的宿主元数据不要手动改，除非某个宿主字段无法从根 manifest 表达。

## 当前支持组件

Usora 当前发布：

- `plugins/foundry/skills/` 下的一个 Skill 目录；
- `plugins/foundry/scripts/usora-mcp.mjs` 这个本地 MCP server 入口；
- 各宿主自己的 MCP 配置文件。

Usora MVP 阶段不发布 `commands`、`agents`、`hooks`、workflows、dashboard 或云服务。
