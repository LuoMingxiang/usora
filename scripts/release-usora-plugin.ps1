param(
  [ValidateSet("patch", "minor", "major")]
  [string]$Bump = "patch",
  [string]$Version,
  [switch]$Commit,
  [switch]$Push
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Read-Json($Path) {
  Get-Content -Raw $Path | ConvertFrom-Json
}

function Write-Json($Path, $Value) {
  $Json = $Value | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText($Path, $Json + [Environment]::NewLine, $Utf8NoBom)
}

function Next-Version($Current, $Bump) {
  $Base = (($Current -split "\+", 2)[0] -split "-", 2)[0]
  $Parts = $Base -split "\."
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

  "$Major.$Minor.$Patch"
}

function Set-Version($Path, $Version) {
  $Json = Read-Json $Path
  if (-not $Json.version) {
    throw "$Path must include version"
  }
  $Json.version = $Version
  Write-Json $Path $Json
  Write-Host "Synced version: $Path"
}

$PortableManifestPath = Join-Path $Root "plugin.json"

$PortableManifest = Read-Json $PortableManifestPath
$OldVersion = $PortableManifest.version
if (-not $OldVersion) {
  throw "$PortableManifestPath must include version"
}

if ($Version) {
  if ($Version -notmatch '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$') {
    throw "Version must be SemVer like 0.1.1, 0.2.0, or 1.0.0-beta.1"
  }
  $NewVersion = $Version
} else {
  $NewVersion = Next-Version $OldVersion $Bump
}

Set-Version $PortableManifestPath $NewVersion

node scripts/plugin.mjs sync
npx prettier --write plugin.json common/marketplace.json marketplace.json .agents/plugins/marketplace.json .mcp.json .codex-plugin/plugin.json .codebuddy-plugin/plugin.json .codebuddy-plugin/marketplace.json .codebuddy-plugin/mcp.json package.json
Write-Host "Updated plugin version: $OldVersion -> $NewVersion"
npm run validate
npm test

if ($Commit) {
  git -C $Root add .agents .codebuddy-plugin .codex-plugin .mcp.json assets CODEBUDDY.md common docs marketplace.json package.json plugin.json README.md README.zh-CN.md scripts skills src
  git -C $Root commit -m "chore: release usora plugin $NewVersion"
}

if ($Push) {
  git -C $Root push
}
