param(
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ManifestPath = Join-Path $Root "plugins/usora/.codex-plugin/plugin.json"
$Manifest = Get-Content -Raw $ManifestPath | ConvertFrom-Json
$CurrentVersion = $Manifest.version
$CacheRoot = Join-Path $env:USERPROFILE ".codex/plugins/cache/usora/usora"

if (-not (Test-Path $CacheRoot)) {
  Write-Host "No Usora plugin cache found: $CacheRoot"
  exit 0
}

$ResolvedCacheRoot = (Resolve-Path $CacheRoot).Path
$ExpectedCacheRoot = Join-Path $env:USERPROFILE ".codex/plugins/cache/usora/usora"
$ResolvedExpected = [System.IO.Path]::GetFullPath($ExpectedCacheRoot)

if ($ResolvedCacheRoot -ne $ResolvedExpected) {
  throw "Refusing to clean unexpected cache root: $ResolvedCacheRoot"
}

$CurrentCache = Join-Path $ResolvedCacheRoot $CurrentVersion
if (-not (Test-Path $CurrentCache)) {
  throw "Current version $CurrentVersion is not installed in cache yet. Upgrade Usora first, then clean old caches."
}

$OldCaches = Get-ChildItem $ResolvedCacheRoot -Directory | Where-Object { $_.Name -ne $CurrentVersion }

if (-not $OldCaches) {
  Write-Host "No old Usora plugin caches to clean."
  exit 0
}

foreach ($Cache in $OldCaches) {
  Write-Host "Old cache: $($Cache.FullName)"
}

if (-not $Apply) {
  Write-Host "Dry run only. Re-run with -Apply to delete old caches."
  exit 0
}

foreach ($Cache in $OldCaches) {
  if (-not $Cache.FullName.StartsWith($ResolvedCacheRoot + [System.IO.Path]::DirectorySeparatorChar)) {
    throw "Refusing to delete path outside Usora cache: $($Cache.FullName)"
  }

  Remove-Item -LiteralPath $Cache.FullName -Recurse -Force
}

Write-Host "Removed $($OldCaches.Count) old Usora plugin cache(s). Kept $CurrentVersion."
