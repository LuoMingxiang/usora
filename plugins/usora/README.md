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

Initialization is simple: say “初始化我的 Usora” and Codex creates the Hub under the default `<cwd>/.usora` directory. The `USORA_HOME` environment variable is not supported.

You can ask Codex:

```text
初始化我的 Usora
把我的 Usora 数据移到 <path>
记录这个任务
查看 Usora 状态
我的 Usora 数据存在哪？
创建一个 Skill 草稿
评估并发布这个 Skill
```

Core flow:

```text
Activity → Candidate → Skill Draft → Evaluation → Publish
```

## Data

The default data directory is `<cwd>/.usora`. To move your data elsewhere, call `hub_config` with a `path` argument (absolute or relative to the workspace). This MOVES all existing records into the new directory and clears the old one, and persists the new location in `config.json` as `hub_path`. `hub_status` reports the resolved `hub` directory and the `config_path`, so you can always find your data.

```text
<hub>/
├── activities/
├── candidates/
├── skills/
├── archive/
└── events/

<cwd>/.usora/config.json   # the config file always lives here
```

If the host does not provide a stable `session_id`, Usora generates a time-ordered ID with a 128-bit random salt so repeated calls in one MCP process merge into one Activity.

## Uninstalling

Uninstalling the plugin is handled by Codex: choose `Uninstall plugin` in the `/plugins` browser, or run `codex plugin marketplace remove <name>`.

Uninstalling does **not** remove local data. To clean up:

1. Run `hub_status` to see where your data lives (`hub`) and where the config is (`config_path`).
2. Clear the data with `hub_cleanup` `mode: all` (requires `confirm: true`). This empties all records, Skills, and events but keeps the data directory and config, so the path remains discoverable.
3. If you want the directory gone too, delete the (now empty) data directory manually.

## MVP boundary

Usora is currently a local, single-user MVP. It does not include a Web UI, cloud sync, team collaboration, public Skill marketplace, or direct AI-to-AI communication.

## Design boundary

The plugin owns storage, lifecycle, roles, and state progression. AI-specific integrations should normalize sessions into Activities and must not implement Skill business logic.
