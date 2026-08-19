<p align="center">
  <img src="docs/assets/usora.png" alt="Usora" width="520">
</p>

<p align="center">
  <strong>把实践转化为能力。</strong>
</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="docs/plugin.zh-CN.md">插件说明</a> ·
  <a href="docs/usage/README.md">使用指南</a> ·
  <a href="CONTRIBUTING.md">参与贡献</a>
</p>

# Usora

Usora 是一个本地优先插件，也是 AI 时代的个人能力层。目前提供 Codex 和 CodeBuddy 原生适配。它的名字来自 _usus_（实践、使用、经验）与 _aura_（不可见的影响场）：由长期实践累积出来的能力场。Usora 会把有价值的会话上下文记录为 Activity，从重复模式中生成 Candidate，再由 Maintainer 评估并发布为可复用的 Skill，而不是把项目记忆交给云端服务。

<p align="center">
  <img src="docs/assets/origin_zh.png" alt="Usora 名称由来：usus 加 aura" width="720">
</p>

```text
Activity -> Candidate -> Skill Draft -> Evaluation -> Publish
```

<p align="center">
  <img src="docs/assets/work_zh.png" alt="Usora 如何把 AI 工作转化为可复用 Skill" width="720">
</p>

## 为什么需要 Usora？

AI 助手常常会反复解决同一类本地工作流问题，但真正有价值的工作方法往往在任务结束后消散。Usora 把经验视为新的个人数据，并为这些经验提供一个轻量生命周期：

- **记录 Activity**：保存任务摘要、关键决策、实现思路、结果和相关技术。
- **发现 Candidate**：把重复出现的模式提升为可审阅的改进候选。
- **审慎发布 Skill**：由 Maintainer 决定哪些经验可以进入可复用行为。
- **演进个人能力**：让过去的实践成为未来 AI 协作的老师。
- **坚持本地优先**：默认使用工作区中的本地文件，不需要 Python、数据库或单独 CLI。

## 当前 MVP

- 初始化并查看本地 Usora Hub。
- 按 AI 会话合并记录 Activity。
- 创建和评估 Candidate。
- 配置 Maintainer 与自动化策略。
- 创建、评估、发布 Skill，并在原地递增版本。
- 查看最近的 Activity、Candidate、Skill 和生命周期事件。
- 归档已处理 Activity。

## 快速开始

从 Codex 或 CodeBuddy 插件市场安装 `Usora` 后，可以直接对 AI agent 说：

```text
初始化我的 Usora
查看 Usora 状态
```

第一分钟的成功标准很简单：你能看到本地 Hub 路径、记录数量和下一步建议。完成真实工作后，再让 Codex 记录这个任务；重复出现的模式之后可以进入 Candidate，并由 Maintainer 发布为 Skill。

默认情况下，Usora 会使用稳定的宿主数据目录（`~/.codex/plugins/data/usora/.usora` 或 `~/.codebuddy/plugins/data/usora/.usora`）；只有本地/手动 MCP 运行时才 fallback 到 `<cwd>/.usora`。插件升级不应该清空 Hub。之后如果想迁移数据目录，可以让 Codex 把 Usora 数据移到新的路径；插件会迁移已有记录，并把新位置保存到 `config.json`。

更详细的插件使用、数据结构和清理说明见 [插件说明](docs/plugin.zh-CN.md)。

## 仓库组织

Usora 现在是 marketplace-style monorepo：插件市场仍叫 `usora`，当前第一个插件 payload 叫 `foundry`。

```text
plugins/foundry/plugin.json            # canonical plugin entry
plugins/foundry/skills/                # Skill instructions
plugins/foundry/src/                   # MCP runtime modules
plugins/foundry/scripts/usora-mcp.mjs  # thin MCP entrypoint
plugins/foundry/.mcp.json              # shared MCP server entry
plugins/foundry/.codex-plugin/         # Codex adapter
plugins/foundry/.codebuddy-plugin/     # CodeBuddy adapter
common/marketplace.json                # marketplace metadata template
marketplace.json                       # generated marketplace metadata
.agents/plugins/marketplace.json       # generated Codex-style marketplace metadata
.claude-plugin/marketplace.json        # generated Claude marketplace metadata
.codebuddy-plugin/marketplace.json     # generated CodeBuddy marketplace metadata
```

编辑 `plugins/foundry/plugin.json` 后运行 `bun run sync`。发布前运行 `bun run doctor`。

### Codex

```powershell
codex plugin marketplace add https://github.com/LuoMingxiang/usora.git
codex plugin add usora@foundry
```

见 [Codex 使用指南](docs/usage/codex.zh-CN.md)。

### CodeBuddy

```powershell
codebuddy plugin marketplace add https://github.com/LuoMingxiang/usora.git
codebuddy plugin install usora@foundry
```

见 [CodeBuddy 使用指南](docs/usage/codebuddy.zh-CN.md)。

## MVP 边界

Usora 当前是本地单用户 MVP，不包含 Web UI、云端同步、团队协作、公开 Skill 市场或 AI 之间的直接通信。

## 参与贡献

欢迎贡献。在提交 PR 前，请先阅读：

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
