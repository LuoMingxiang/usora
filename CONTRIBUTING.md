# Contributing to Usora

感谢你有兴趣为 Usora 做贡献！Usora 是一个本地优先的 AI 能力沉淀插件。无论你是修复 bug、改进文档，还是提出新想法，都非常欢迎。

## 开始之前

- 请先阅读 [README.md](README.md) 了解项目定位与 MVP 边界。
- 如果你想提的是较大的功能改动，建议先开一个 issue 描述你的想法，与维护者讨论后再动手，避免白费功夫。

## 如何贡献

### 报告 Bug / 提建议

请通过 GitHub Issues 提交，并尽可能包含：

- 复现步骤
- 预期行为与实际行为
- 运行环境（Codex 版本、操作系统等）
- 相关日志或截图（注意隐去敏感信息）

### 提交代码（Pull Request）

1. Fork 本仓库并克隆到本地。
2. 从 `master` 分支创建你的功能分支：

   ```bash
   git checkout -b feat/my-change
   ```

3. 做出你的修改，并补充或更新相应的测试与文档。
4. 提交时使用 [Conventional Commits](https://www.conventionalcommits.org/) 风格；Husky 会在 `commit-msg` 阶段通过 commitlint 校验。

   ```text
   feat: add candidate deduplication
   fix(usora): handle missing session_id gracefully
   docs: clarify hub_config path semantics
   ```

5. 推送你的分支并发起 Pull Request（目标分支为 `master`）。
6. 在 PR 描述中说明改了什么、为什么改，以及如何验证。

## 开发约定

- 插件核心逻辑位于 `plugins/foundry/src/`，MCP 入口为 `src/cli/mcp.ts`，工具注册位于 `src/mcp/`。
- 宿主加载构建生成的 `plugins/foundry/dist/mcp.js`；当前仓库跟踪该构建产物，应通过构建更新，不要手工修改。
- 测试位于 `test/unit/` 和 `test/integration/`；集成测试使用构建后的 Node.js MCP 入口。
- 插件行为规范（自然语言到工具的映射）：`plugins/foundry/skills/usora-skill-hub/SKILL.md`
- 插件清单以 `plugins/<name>/plugin.json` 为准；修改后运行 `bun run sync` 生成宿主和市场元数据。
- 新插件、构建与发布流程见[插件平台说明](docs/plugin/create/README.zh-CN.md)。
- Session 协议与数据源扩展见[宿主适配指南](docs/plugin/host-adapters.md)。

### 运行测试

本项目使用 Bun 管理依赖，运行时代码仍是 Node.js（ESM）。在仓库根目录运行：

```bash
bun install --no-save
bun run check
```

`bun run check` 包含构建、集成测试及打包检查。单独运行 `bun run test` 前请先运行 `bun run build`。请确保你的改动不会破坏现有测试，并为新功能补充测试。

文档应描述当前实现；使用方法放在 `docs/usage/`，插件开发约定放在 `docs/plugin/`，协议放在 `docs/protocol/`。已完成的计划和临时进度日志不作为长期入口；需要保留的契约并入相应指南，验收证据保留在 `docs/examples/`。Skill 导出的复现命令、实际宿主验证和平台限制见[可移植性指南](docs/usage/skill-portability.md)及[验收记录](docs/examples/skill-portability/acceptance.md)。

### 代码风格

- 保持与现有代码一致的风格。
- 提交前请自查：无多余调试输出，无敏感信息（token、密钥等）入库。

## 需要帮助？

如果你在贡献过程中遇到问题，欢迎在 Issue 中提问。

再次感谢你的贡献！
