# CodeBuddy 使用指南

## 安装

```powershell
codebuddy plugin marketplace add https://github.com/LuoMingxiang/usora.git
codebuddy plugin install usora@foundry
```

本地开发时可以直接加载插件：

```powershell
codebuddy --plugin-dir plugins/foundry
```

Usora Foundry 通过 `plugins/foundry/.codebuddy-plugin/plugin.json` 加载，并指向 `.codebuddy-plugin/mcp.json`。
MCP 配置使用：

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

`CODEBUDDY_PLUGIN_ROOT` 必须解析到已安装的 Usora 插件根目录。否则 CodeBuddy 可能会把 `dist/mcp.js` 解析到 VS Code 安装目录，并报 `MODULE_NOT_FOUND`。

CodeBuddy 可能会把 marketplace source clone 到 `~/.codebuddy/plugins/marketplaces`。这是正常的。Usora 会把 Hub 数据放到 `~/.codebuddy/plugins/data/usora/.usora`，所以升级不会清空 Hub，也不会写到当前项目。

## 试用

```text
Initialize my Usora Skill Hub
Show Usora status
Capture this session into Usora
```

## 升级

Usora 的 CodeBuddy marketplace 可以从 GitHub `master` 添加，但 Foundry 插件 payload 指向生成后的 `marketplace` 分支。本地改动必须经过 release 流程发布该分发分支后，才会成为可安装版本。

```powershell
git push origin master
codebuddy plugin update usora@foundry
```

Release workflow 会先运行 plugin-aware release scripts、同步插件元数据并打 tag。

## 缓存清理

```text
Clean old Usora plugin cache
```

这个 tool 会先 dry run。只有当它列出的旧版本符合预期时，再确认删除。
