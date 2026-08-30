# 插件平台说明

Usora 是一个 TypeScript-first 的多插件 marketplace monorepo。每个插件都拥有一个 canonical manifest、一套 TypeScript 源码、一份构建产物，以及零份手工维护的生成 JavaScript。

## 分发模型

Usora 有三层：

| 层级                | 用途                 | 包含内容                                                               | 禁止包含                                                      |
| :------------------ | :------------------- | :--------------------------------------------------------------------- | :------------------------------------------------------------ |
| Source branch       | 贡献者开发           | `plugins/*/src/**/*.ts`、tests、packages、tooling                      | 已提交的 `dist/`                                              |
| Distribution tree   | Git marketplace 载荷 | `marketplace.json`、`plugins/*/dist`、runtime metadata、skills、assets | `src/`、tests、`packages/`、`tooling/`、`.ts`、`.mjs`、`.map` |
| Per-plugin artifact | 单插件下载/发布载荷  | 单个插件的运行时包                                                     | 任意 workspace 专属文件                                       |

对外发布的 marketplace 安装必须指向生成后的 `marketplace` 分支，或等价的 distribution 导出，而不是 source branch。

## Canonical 插件目录

每个插件最少遵循这套结构：

```text
plugins/<name>/
├── src/
│   └── cli/mcp.ts
├── skills/
├── hooks/
├── assets/
├── .codex-plugin/
├── .codebuddy-plugin/
├── .mcp.json
├── plugin.json
├── package.json
└── tsconfig.json
```

`src/**/*.ts` 是唯一业务源码。`dist/*.js` 由构建生成，也是宿主唯一允许加载的运行时。

## Manifest 与宿主元数据

优先编辑 `plugins/<name>/plugin.json`。这个文件是以下信息的单一事实源：

- 插件身份：`name`、`displayName`、`version`、`description`
- 运行时契约：`runtime.node`、`entrypoints`
- 可移植能力：`skills`、`mcpServers`、面向宿主的界面元数据

当前 runtime 入口必须指向构建后的 JavaScript，例如：

```json
{
  "schemaVersion": 1,
  "name": "foundry",
  "runtime": { "node": ">=20" },
  "entrypoints": {
    "mcp": "dist/mcp.js",
    "sessionHook": "dist/session-hook.js"
  }
}
```

然后同步生成的 marketplace metadata：

```powershell
bun run sync
bun run doctor
```

宿主生成文件应当保持“生成态”。只有当某个宿主字段无法由根 manifest 表达时，才补充宿主特定字段。

## 构建、测试与打包

贡献者日常闭环：

```powershell
bun run check
bun run build
bun run package:check
bun run runtime:check
```

常用单插件命令：

```powershell
bun run build:foundry
bun run package:foundry
bun run release:plan
bun run release:plugins
```

`bun run check` 是生产级门禁，覆盖 format、lint、typecheck、build、package validation、clean runtime validation、marketplace validation、tests 和 plugin validation。

## 新插件脚手架

创建新插件：

```powershell
bun run plugin:create <name>
```

脚手架会生成：

- 包含 schema、version、node runtime 和 `dist/mcp.js` 入口的 `plugin.json`
- `src/cli/mcp.ts`
- `.mcp.json`
- `.codex-plugin/plugin.json`
- `.codebuddy-plugin/plugin.json`
- `.codebuddy-plugin/mcp.json`
- `hooks/*.json`
- `package.json`
- `tsconfig.json`

创建后执行：

```powershell
bun run sync
bun run build
bun run test
```

只要新增合法的 `plugins/<name>/plugin.json`，插件就会自动进入 discovery、affected analysis、CI matrix、package validation 和 release planning；不需要再手改 Foundry allow-list。

## 发布与分发

Usora 支持两种生产分发模式：

1. Git marketplace 分发：`bun run marketplace:build` 生成 clean marketplace tree，`bun run release:marketplace` 发布生成后的 `marketplace` 分支。
2. Per-plugin artifact 分发：`bun run package` 生成 `artifacts/usora-<plugin>-<version>.zip` 和 checksum，`bun run release:plugins` 把可发布插件转成带 tag 的 GitHub Release。

版本按插件独立管理。插件 tag、manifest version 与打包产物 version 必须一致。

## 最小 Host Adapter 规则

新增宿主适配器时：

- 保持 `plugins/<name>/plugin.json` 为 canonical
- runtime metadata 只能指向 `dist/*.js`
- 仅用宿主局部变量解决路径问题，例如 `${CODEBUDDY_PLUGIN_ROOT}`
- host adapter 保持薄边界：路径解析、宿主元数据形状、可选的宿主专属默认提示
- 不要把 `src/` 里的业务逻辑搬进宿主 metadata 或 wrapper

如果宿主需要不同的 marketplace 文件或 MCP 配置形状，应当从 canonical manifest 生成，而不是分叉插件行为。
