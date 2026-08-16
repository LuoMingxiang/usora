<p align="center">
  <img src="assets/logo.png" alt="Usora logo" width="120">
</p>

<p align="center">
  <strong>Usora for Codex</strong><br>
  Turn practice into reusable AI capability.
</p>

<p align="center">
  <a href="../../README.md">Project README</a> ·
  <a href="README.zh-CN.md">中文</a>
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
- List recent Activities, Candidates, Skills, and lifecycle events.
- Read one Skill by name.
- Check local Hub health.
- Archive processed Activities.

## Quick Start

Use the Usora MCP tools through Codex. No Python, database, or separate CLI installation is required.

Ask Codex:

```text
Initialize my Usora
Show Usora status
Capture this session
Show recent Activities
Where is my Usora data?
Move my Usora data to <path>
Show recent Candidates
Create a Skill draft
Evaluate and publish this Skill
Show recent Skills
Show this Skill
Show recent Usora events
Check my Skill Hub health
```

For a 60-second first run, start with `Initialize my Usora` and `Show Usora status`. You should see the local Hub path, Activity/Candidate/Skill counts, and a next useful action.

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

## Upgrading and Uninstalling

Codex installs plugins into its local plugin cache and loads the installed copy, not the live source directory. For Usora, the marketplace entry points at GitHub `master`, so local changes only become installable after they are committed and pushed.

If a new Usora build is not visible after pulling or pushing changes, use this release loop:

1. Finish the plugin change locally.
2. Choose the release version:

   - `patch`: fixes, docs, copy, metadata, small compatible improvements.
   - `minor`: new compatible MVP capability or visible workflow improvement.
   - `major`: breaking storage, tool, or Skill contract change. Usora should usually stay in `0.x` during MVP.

3. Run the release helper from the repo root:

   ```text
   ./scripts/release-usora-plugin.ps1
   ```

   The helper bumps the plugin SemVer patch version by default, validates the plugin manifest, and runs the Node MCP tests.

   Use `-Bump minor` or `-Bump major` when needed:

   ```text
   ./scripts/release-usora-plugin.ps1 -Bump minor
   ```

   To set an exact version:

   ```text
   ./scripts/release-usora-plugin.ps1 -Version 0.2.0
   ```

4. Review the diff.
5. Commit and push the plugin changes.
6. Open `/plugins`, find Usora, and upgrade or reinstall it.
7. Refresh or restart Codex and open a new task if older MCP tools still appear.
8. After the new version is installed, clean old Usora cache directories if needed:

   ```text
   ./scripts/cleanup-usora-plugin-cache.ps1
   ./scripts/cleanup-usora-plugin-cache.ps1 -Apply
   ```

   The first command is a dry run. The `-Apply` command removes old `~/.codex/plugins/cache/usora/usora/<version>` directories and keeps the currently released version.

To do the release commit and push in one run:

```text
./scripts/release-usora-plugin.ps1 -Commit -Push
```

Use this after reviewing or when the change is already ready to publish. It bumps the patch version, validates, tests, commits `plugins/usora` and the release helper, then pushes. Add `-Bump minor` or `-Version 0.2.0` before `-Commit -Push` for larger releases.

Codex handles plugin removal. Use `Uninstall plugin` in the `/plugins` browser.

Because Usora includes a local MCP server, Codex may ask you to disable Usora before uninstalling it. Disabling first removes Usora's tools from the callable set before the cached plugin bundle is removed. Pure Skill-only plugins may be able to uninstall directly.

From a terminal, remove the installed plugin with:

```text
codex plugin remove usora@usora
```

`codex plugin marketplace remove <marketplace-name>` removes a configured marketplace source. It is not the normal per-plugin uninstall path.

After upgrading or uninstalling an MCP-backed plugin, refresh or restart Codex and open a new task if older tools still appear.

Uninstalling the plugin does **not** remove local Usora data.

To clean data:

1. Run `hub_status` to locate `hub` and `config_path`.
2. Run `hub_cleanup` with `mode: all` and `confirm: true`.
3. Delete the now-empty data directory manually if you also want the directory removed.

## MVP Boundary

Usora is currently a local, single-user MVP. It does not include a Web UI, cloud sync, team collaboration, a public Skill marketplace, or direct AI-to-AI communication.

## Design Boundary

The plugin owns storage, lifecycle, roles, and state progression. AI-specific integrations should normalize sessions into Activities and must not implement Skill business logic.
