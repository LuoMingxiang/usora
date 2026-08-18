# CodeBuddy 使用指南

## 安装

```powershell
codebuddy plugin marketplace add https://github.com/LuoMingxiang/usora.git
codebuddy plugin install usora@usora
```

本地开发时可以直接加载插件：

```powershell
codebuddy --plugin-dir .
```

Usora 通过 `.codebuddy-plugin/plugin.json` 加载，并指向 `.codebuddy-plugin/mcp.json`。
MCP 配置使用：

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

`CODEBUDDY_PLUGIN_ROOT` 必须解析到已安装的 Usora 插件根目录。否则 CodeBuddy 可能会把 `scripts/usora-mcp.mjs` 解析到 VS Code 安装目录，并报 `MODULE_NOT_FOUND`。

CodeBuddy 可能会把 marketplace source clone 到 `~/.codebuddy/plugins/marketplaces`。这是正常的。Usora 会优先把 Hub 数据放到 `CODEBUDDY_PLUGIN_DATA`；如果没有这个变量，则放到 `~/.codebuddy/plugins/data/usora/.usora`，不会写到当前项目。

## 试用

```text
Initialize my Usora Skill Hub
Show Usora status
Capture this session into Usora
```

## 升级

Usora 的 marketplace entry 指向 GitHub `master`。本地改动必须 commit 并 push 后，才会成为可安装版本。

```powershell
./scripts/release-usora-plugin.ps1 -Commit -Push
codebuddy plugin update usora@usora
```

## 缓存清理

```powershell
./scripts/cleanup-usora-plugin-cache.ps1 -HostName codebuddy
./scripts/cleanup-usora-plugin-cache.ps1 -HostName codebuddy -Apply
```

第一条是 dry run。
