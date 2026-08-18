# 插件平台说明

Usora 采用一个 canonical plugin payload，加上薄宿主适配层。

| 宿主           | Manifest                        | Marketplace                          | MCP 配置                     |
| :------------- | :------------------------------ | :----------------------------------- | :--------------------------- |
| Community/root | `plugin.json`                   | `marketplace.json`                   | `.mcp.json`                  |
| Codex          | `.codex-plugin/plugin.json`     | `.agents/plugins/marketplace.json`   | `.mcp.json`                  |
| CodeBuddy      | `.codebuddy-plugin/plugin.json` | `.codebuddy-plugin/marketplace.json` | `.codebuddy-plugin/mcp.json` |

## 单一事实源

优先编辑 `plugin.json`，然后运行：

```powershell
npm run sync
npm run doctor
```

生成的宿主元数据不要手动改，除非某个宿主字段无法从根 manifest 表达。

## 当前支持组件

Usora 当前发布：

- `skills/` 下的一个 Skill 目录；
- `scripts/usora-mcp.mjs` 这个本地 MCP server 入口；
- 各宿主自己的 MCP 配置文件。

Usora MVP 阶段不发布 `commands`、`agents`、`hooks`、workflows、dashboard 或云服务。
