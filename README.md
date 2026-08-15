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

默认数据目录为当前工作区的 `.usora`，以适配 Codex MCP 沙箱；也可以通过 `USORA_HOME` 指定跨工作区、跨 AI 共用的 Hub。

## MVP 边界

Usora 当前是本地单用户 MVP，不包含 Web UI、云端同步、团队协作、公开 Skill 市场或 AI 之间的直接通信。

更多插件使用说明见 [插件 README](plugins/usora/README.md)。
