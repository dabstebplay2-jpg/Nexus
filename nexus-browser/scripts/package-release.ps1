$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

# Skip code signing (winCodeSign needs symlink rights on Windows without Developer Mode).
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

Write-Host "=== Nexus Browser: Windows release build ===" -ForegroundColor Cyan

& (Join-Path $PSScriptRoot "clean-dist.ps1") -Phase before
npm run dist
& (Join-Path $PSScriptRoot "clean-dist.ps1") -Phase after

$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$version = $pkg.version
$portable = Join-Path dist "NexusBrowser-$version-Portable.exe"
$setup = Join-Path dist "NexusBrowser-$version-Setup.exe"

Write-Host ""
if (Test-Path $portable) {
  $mb = [math]::Round((Get-Item $portable).Length / 1MB, 1)
  Write-Host "Portable: $portable ($mb MB)" -ForegroundColor Green
}
if (Test-Path $setup) {
  $mb = [math]::Round((Get-Item $setup).Length / 1MB, 1)
  Write-Host "Setup:    $setup ($mb MB)" -ForegroundColor Green
}
if (-not (Test-Path $portable) -and -not (Test-Path $setup)) {
  Write-Host "Check dist/ for electron-builder output" -ForegroundColor Yellow
}
