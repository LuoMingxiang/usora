param(
  [switch]$Commit,
  [switch]$Push
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Plugin = Join-Path $Root "plugins/usora"
$Helper = Join-Path $env:USERPROFILE ".codex/skills/.system/plugin-creator/scripts/update_plugin_cachebuster.py"
$Validator = Join-Path $env:USERPROFILE ".codex/skills/.system/plugin-creator/scripts/validate_plugin.py"

python $Helper $Plugin
python $Validator $Plugin
node --test (Join-Path $Plugin "scripts/usora-mcp.test.mjs")

if ($Commit) {
  git -C $Root add (Join-Path $Plugin ".codex-plugin/plugin.json") (Join-Path $Plugin "README.md")
  git -C $Root commit -m "Release Usora plugin cachebuster"
}

if ($Push) {
  git -C $Root push
}
