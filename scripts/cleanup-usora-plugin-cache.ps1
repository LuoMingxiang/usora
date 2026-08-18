param(
  [ValidateSet("codex", "codebuddy", "all")]
  [string]$HostName = "codex",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ManifestPath = Join-Path $Root ".codex-plugin/plugin.json"
$CurrentVersion = (Get-Content -Raw $ManifestPath | ConvertFrom-Json).version

if (-not $CurrentVersion) {
  throw "$ManifestPath must include version"
}

$CacheRoots = @{
  codex = Join-Path $env:USERPROFILE ".codex/plugins/cache/usora/usora"
  codebuddy = Join-Path $env:USERPROFILE ".codebuddy/plugins/cache/usora/usora"
}

function Clear-UsoraCache($Name, $CacheRoot) {
  if (-not (Test-Path $CacheRoot)) {
    Write-Host "No Usora $Name plugin cache found: $CacheRoot"
    return
  }

  $ResolvedCacheRoot = (Resolve-Path $CacheRoot).Path
  $ExpectedCacheRoot = [System.IO.Path]::GetFullPath($CacheRoot)
  if ($ResolvedCacheRoot -ne $ExpectedCacheRoot) {
    throw "Refusing to clean unexpected $Name cache root: $ResolvedCacheRoot"
  }

  $CurrentCache = Join-Path $ResolvedCacheRoot $CurrentVersion
  if (-not (Test-Path $CurrentCache)) {
    Write-Host "Current version $CurrentVersion is not installed in $Name cache yet: $CurrentCache"
    return
  }

  $OldCaches = @(Get-ChildItem $ResolvedCacheRoot -Directory | Where-Object { $_.Name -ne $CurrentVersion })
  if (-not $OldCaches) {
    Write-Host "No old Usora $Name plugin caches to clean."
    return
  }

  foreach ($Cache in $OldCaches) {
    Write-Host "Old $Name cache: $($Cache.FullName)"
  }

  if (-not $Apply) {
    Write-Host "Dry run only for $Name. Re-run with -Apply to delete old caches."
    return
  }

  foreach ($Cache in $OldCaches) {
    if (-not $Cache.FullName.StartsWith($ResolvedCacheRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to delete path outside Usora $Name cache: $($Cache.FullName)"
    }

    Remove-Item -LiteralPath $Cache.FullName -Recurse -Force
  }

  Write-Host "Removed $($OldCaches.Count) old Usora $Name plugin cache(s). Kept $CurrentVersion."
}

$Targets = if ($HostName -eq "all") { @("codex", "codebuddy") } else { @($HostName) }
foreach ($Target in $Targets) {
  Clear-UsoraCache $Target $CacheRoots[$Target]
}
