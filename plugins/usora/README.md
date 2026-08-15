# Usora

Usora 是一个本地优先的 AI 能力沉淀插件：把真实工作记录为 Activity，从重复模式生成 Candidate，再由 Maintainer 评估并发布可复用的 Skill。

## MVP 能力

- 初始化本地 Usora 存储
- 按会话合并记录 Activity
- 创建和评估 Candidate
- 配置 Maintainer 与自动化策略
- 创建、评估、发布 Skill
- Skill 原地版本递增
- 归档已处理 Activity

## Quick start

Use the Usora MCP tools from Codex. No Python or separate CLI installation is required.

The default Hub is `~/.usora`, or set `USORA_HOME` to use a project-local directory.

The MCP server initializes Usora lazily, captures real Activities, records Candidates and evaluations, and publishes Skills only through the configured Maintainer.

You can ask Codex:

```text
初始化我的 Usora
记录这个任务
查看 Usora 状态
创建一个 Skill 草稿
评估并发布这个 Skill
```

Core flow:

```text
Activity → Candidate → Skill Draft → Evaluation → Publish
```

## Data

The default data directory is `~/.usora`. Set `USORA_HOME` to use a project-local directory.

```text
~/.usora/
├── config.json
├── activities/
├── candidates/
├── skills/
├── archive/
└── events/
```

If the host does not provide a stable `session_id`, Usora generates a time-ordered ID with a 128-bit random salt so repeated calls in one MCP process merge into one Activity.

## MVP boundary

Usora is currently a local, single-user MVP. It does not include a Web UI, cloud sync, team collaboration, public Skill marketplace, or direct AI-to-AI communication.

## Design boundary

The plugin owns storage, lifecycle, roles, and state progression. AI-specific integrations should normalize sessions into Activities and must not implement Skill business logic.
