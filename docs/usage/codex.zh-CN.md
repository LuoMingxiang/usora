# Codex 使用指南

## 安装

```powershell
codex plugin marketplace add https://github.com/LuoMingxiang/usora.git
codex plugin add usora@usora
```

Usora 通过 `.codex-plugin/plugin.json` 加载，并指向根目录 `.mcp.json`。
MCP 配置使用：

```json
{
  "usora": {
    "command": "node",
    "args": ["scripts/usora-mcp.mjs"],
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
./scripts/release-usora-plugin.ps1 -Commit -Push
```

然后在 `/plugins` 里升级 Usora。如果 UI 提示 upgrade failed 但版本号已经变化，打开新 task 检查预期的 Usora tools 是否可用。

## 缓存清理

```text
Clean old Usora plugin cache
```

开发者 fallback：

```powershell
./scripts/cleanup-usora-plugin-cache.ps1 -HostName codex
./scripts/cleanup-usora-plugin-cache.ps1 -HostName codex -Apply
```

第一条是 dry run。
