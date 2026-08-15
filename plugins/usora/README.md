<p align="center">
  <img src="assets/logo.png" alt="Usora logo" width="120">
</p>

<p align="center">
  <strong>Usora for Codex</strong><br>
  Turn practice into reusable AI capability.
</p>

<p align="center">
  <a href="../../README.md">Project README</a> ·
  <a href="../../README.zh-CN.md">中文</a>
</p>

# Usora Plugin

Usora is a Codex plugin for building a personal capability layer from everyday AI work. The name combines *usus* (practice, usage, experience) with *aura* (an invisible field of influence): the capability field created by accumulated practice. It records useful AI work as Activities, promotes reusable patterns into Candidates, and helps a configured Maintainer publish Skills.

<p align="center">
  <img src="assets/origin.png" alt="Usora name origin: usus plus aura" width="720">
</p>

## Core Flow

```text
Activity -> Candidate -> Skill Draft -> Evaluation -> Publish
```

<p align="center">
  <img src="assets/work.png" alt="How Usora turns AI work into reusable skills" width="720">
</p>

## Capabilities

- Initialize local Usora storage.
- Merge Activity captures by session.
- Create and evaluate Candidates.
- Configure Maintainer and automation policy.
- Create, evaluate, publish, and revise Skills in place.
- Archive processed Activities.

## Quick Start

Use the Usora MCP tools through Codex. No Python, database, or separate CLI installation is required.

Ask Codex:

```text
Initialize my Usora
Move my Usora data to <path>
Capture this session
Show Usora status
Where is my Usora data?
Create a Skill draft
Evaluate and publish this Skill
```

## Data

The default data directory is `<cwd>/.usora`. The `USORA_HOME` environment variable is not supported.

To move data elsewhere, call `hub_config` with a `path` argument, either absolute or relative to the workspace. Usora moves existing records into the new directory, clears the old record folders, and persists the new location in `config.json` as `hub_path`.

`hub_status` reports both the resolved `hub` directory and `config_path`.
It also returns `next_action`, a small lifecycle hint:

```text
capture_activity -> Capture this session
create_candidate -> Create a Candidate
create_skill -> Create a Skill draft
review_or_cleanup -> Review Skills or clean processed Activities
```

A human-readable status summary should keep this order:

```text
Usora Hub
Status: initialized
Data: <hub>
Config: <config_path>
Maintainer: <config.maintainer>
Policy: <config.automation_policy>

Records
Activities: <activities>
Candidates: <candidates>
Skills: <skills>

Next useful action: <next_action label>
```

```text
<hub>/
├── activities/
├── candidates/
├── skills/
├── archive/
└── events/

<cwd>/.usora/config.json   # config file
```

If the host does not provide a stable `session_id`, Usora generates a process-scoped ID with a time-ordered prefix and 128-bit random salt so repeated captures in one MCP process update one Activity.

## Uninstalling

Codex handles plugin removal. Use `Uninstall plugin` in the `/plugins` browser, or remove the marketplace entry with:

```text
codex plugin marketplace remove <name>
```

Uninstalling the plugin does **not** remove local Usora data.

To clean data:

1. Run `hub_status` to locate `hub` and `config_path`.
2. Run `hub_cleanup` with `mode: all` and `confirm: true`.
3. Delete the now-empty data directory manually if you also want the directory removed.

## MVP Boundary

Usora is currently a local, single-user MVP. It does not include a Web UI, cloud sync, team collaboration, a public Skill marketplace, or direct AI-to-AI communication.

## Design Boundary

The plugin owns storage, lifecycle, roles, and state progression. AI-specific integrations should normalize sessions into Activities and must not implement Skill business logic.
