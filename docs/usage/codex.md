# Codex Usage

## Install

```powershell
codex plugin marketplace add https://github.com/LuoMingxiang/usora.git
codex plugin add usora@foundry
```

Usora Foundry is loaded through `plugins/foundry/.codex-plugin/plugin.json`, which points to the plugin root `.mcp.json`.
The MCP config starts:

```json
{
  "practice": {
    "command": "node",
    "args": ["scripts/usora-mcp.mjs"],
    "cwd": "."
  }
}
```

## Try

```text
Initialize my Usora Skill Hub
Show Usora status
Capture this session into Usora
```

## Upgrade

Usora's marketplace entry points to GitHub `master`. Local changes only become installable after commit and push.

```powershell
git push origin master
```

The Release workflow runs `semantic-release`, syncs plugin metadata, and tags the release. Then upgrade Usora in `/plugins`. If the UI says upgrade failed but the version changed, open a new task and check whether the expected Usora tools are available.

## Cache Cleanup

```text
Clean old Usora plugin cache
```

The tool starts with a dry run. Confirm deletion only after it lists the old versions you expect.
