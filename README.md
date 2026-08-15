# Usora

Usora 是一个本地优先的 AI 能力沉淀插件。它把真实工作记录为 Activity，从重复模式生成 Candidate，再由 Maintainer 评估并发布可复用的 Skill。

## MVP

```text
Activity → Candidate → Skill Draft → Evaluation → Publish
```

当前 MVP 支持：

- 本地 Hub 初始化与状态查看
- Activity 按会话合并记录
- Candidate 创建与评估
- Maintainer 和自动化策略配置
- Skill 创建、评估、发布与版本递增
- 已处理 Activity 归档

## 安装

从插件市场安装 `Usora`。插件使用 Codex MCP，不需要 Python、数据库或单独 CLI。

## 使用

安装后可以直接对 Codex 说：

```text
初始化我的 Usora
记录这个任务
查看 Usora 状态
创建并发布一个 Skill
```

初始化是引导式交互，且**必须先选择数据目录**：说「初始化我的 Usora」后，Codex 会依次引导你选择数据目录、Primary Maintainer 和自动化策略，确认后才创建 Hub。在选定目录之前，任何数据都不会被写入；`hub_status` 会返回 `located: false` 并提示先选目录。

初始化时选择的目录会通过 `hub_init` 的 `path` 参数持久化到 `config.json` 的 `hub_path`，之后所有操作自动沿用；`hub_status` 会返回实际数据目录和配置文件路径，方便随时定位数据。之后想改目录，说一声即可通过 `hub_config` 的 `path` 立即生效，无需重启。

> 注意：不再支持 `USORA_HOME` 环境变量，目录必须由用户在初始化时显式选择。

## 卸载

卸载插件由 Codex 负责：在 `/plugins` 插件浏览器中选择 `Uninstall plugin`，或使用 `codex plugin marketplace remove <name>` 移除市场。

注意：卸载插件**不会删除本地数据**。如需彻底清理，请先通过 `hub_status` 查看数据所在路径，再通过 `hub_cleanup` 的 `mode: all`（需 `confirm: true`）清空 Hub 数据（会保留数据目录和配置文件，便于后续确认路径）；若想连目录一起删除，再手动删除数据目录本身。

## MVP 边界

Usora 当前是本地单用户 MVP，不包含 Web UI、云端同步、团队协作、公开 Skill 市场或 AI 之间的直接通信。

更多插件使用说明见 [插件 README](plugins/usora/README.md)。
