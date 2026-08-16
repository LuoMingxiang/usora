param(
  [ValidateSet("patch", "minor", "major")]
  [string]$Bump = "patch",
  [string]$Version,
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
$BaseVersion = (($OldVersion -split "\+", 2)[0] -split "-", 2)[0]

if ($Version) {
  if ($Version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {
    throw "Version must be SemVer like 0.1.1, 0.2.0, or 1.0.0-beta.1"
  }

  $NewVersion = $Version
} else {
  $Parts = $BaseVersion -split "\."
  if ($Parts.Count -ne 3) {
    throw "Current version must be SemVer like 0.1.0"
  }

  $Major = [int]$Parts[0]
  $Minor = [int]$Parts[1]
  $Patch = [int]$Parts[2]

  switch ($Bump) {
    "major" {
      $Major += 1
      $Minor = 0
      $Patch = 0
    }
    "minor" {
      $Minor += 1
      $Patch = 0
    }
    "patch" {
      $Patch += 1
    }
  }

  $NewVersion = "$Major.$Minor.$Patch"
}

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
  git -C $Root add $Plugin (Join-Path $Root "scripts/release-usora-plugin.ps1")
  git -C $Root commit -m "Release Usora plugin $NewVersion"
}

if ($Push) {
  git -C $Root push
}
