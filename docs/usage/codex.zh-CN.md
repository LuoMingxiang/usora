# Codex 使用指南

## 安装

```powershell
codex plugin marketplace add https://github.com/LuoMingxiang/usora.git
codex plugin add usora@foundry
```

Usora Foundry 通过 `plugins/foundry/.codex-plugin/plugin.json` 加载，并指向插件根目录 `.mcp.json`。
MCP 配置使用：

```json
{
  "practice": {
    "command": "node",
    "args": ["dist/mcp.js"],
    "cwd": "."
  }
}
```

## 试用

```text
Initialize my Usora Skill Hub
Show Usora status
Capture this session into Usora
```

## 升级

Usora 的 marketplace entry 指向 GitHub `master`。本地改动必须 commit 并 push 后，才会成为可安装版本。

```powershell
git push origin master
```

Release workflow 会运行 plugin-aware release scripts、同步插件元数据并打 tag。然后在 `/plugins` 里升级 Usora。如果 UI 提示 upgrade failed 但版本号已经变化，打开新 task 检查预期的 Usora tools 是否可用。

## 缓存清理

```text
Clean old Usora plugin cache
```

这个 tool 会先 dry run。只有当它列出的旧版本符合预期时，再确认删除。
