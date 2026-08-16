param(
  [switch]$Commit,
  [switch]$Push
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Plugin = Join-Path $Root "plugins/usora"
$ManifestPath = Join-Path $Plugin ".codex-plugin/plugin.json"

$RawManifest = Get-Content -Raw $ManifestPath
$VersionMatch = [regex]::Match($RawManifest, '("version"\s*:\s*")([^"]+)(")')
if (-not $VersionMatch.Success) {
  throw "plugin.json must include version"
}

$OldVersion = $VersionMatch.Groups[2].Value
$BaseVersion = ($OldVersion -split "\+", 2)[0]
$Cachebuster = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss")
$NewVersion = "$BaseVersion+codex.$Cachebuster"
$UpdatedManifest = $RawManifest.Substring(0, $VersionMatch.Groups[2].Index) + $NewVersion + $RawManifest.Substring($VersionMatch.Groups[2].Index + $VersionMatch.Groups[2].Length)
[System.IO.File]::WriteAllText($ManifestPath, $UpdatedManifest, [System.Text.UTF8Encoding]::new($false))
$Manifest = $UpdatedManifest | ConvertFrom-Json

Write-Host "Updated plugin version: $OldVersion -> $NewVersion"

if (-not $Manifest.name) {
  throw "plugin.json must include name"
}

if (-not $Manifest.version) {
  throw "plugin.json must include version"
}

if ($Manifest.skills -and -not (Test-Path (Join-Path $Plugin $Manifest.skills))) {
  throw "plugin.json skills path does not exist: $($Manifest.skills)"
}

if ($Manifest.mcpServers -and -not (Test-Path (Join-Path $Plugin $Manifest.mcpServers))) {
  throw "plugin.json mcpServers path does not exist: $($Manifest.mcpServers)"
}

Write-Host "Plugin manifest validation passed: $ManifestPath"
node --test (Join-Path $Plugin "scripts/usora-mcp.test.mjs")

if ($Commit) {
  git -C $Root add (Join-Path $Plugin ".codex-plugin/plugin.json") (Join-Path $Plugin "README.md")
  git -C $Root commit -m "Release Usora plugin cachebuster"
}

if ($Push) {
  git -C $Root push
}
