# setup-defender-exclusions.ps1
# Run once with: powershell -ExecutionPolicy Bypass -File scripts/setup-defender-exclusions.ps1
# Requires: Administrator rights (right-click PowerShell -> Run as Administrator)
#
# WHY: Windows Defender real-time scanning locks .rcgu.o files during Rust compilation,
# causing "os error 32: being used by another process" build failures.
# This is a known issue: https://github.com/rust-lang/cargo/issues/5028

$ErrorActionPreference = "Stop"

# Self-elevate if not running as admin
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Requesting administrator privileges..." -ForegroundColor Yellow
    $scriptPath = $MyInvocation.MyCommand.Path
    if (-not $scriptPath) { $scriptPath = $PSCommandPath }
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs -Wait
    exit $LASTEXITCODE
}

Write-Host "Adding Windows Defender exclusions for Rust development..." -ForegroundColor Cyan
Write-Host ""

$exclusions = @(
    "$env:USERPROFILE\.cargo",
    "$env:USERPROFILE\.rustup",
    "$PSScriptRoot\..\src-tauri\target",
    "$PSScriptRoot\..\src-tauri\binaries"
)

$processExclusions = @(
    "rustc.exe",
    "cargo.exe"
)

foreach ($path in $exclusions) {
    $resolved = (Resolve-Path $path -ErrorAction SilentlyContinue)
    if (-not $resolved) { $resolved = $path }
    try {
        Add-MpPreference -ExclusionPath $resolved
        Write-Host "  [OK] Excluded path: $resolved" -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] Could not exclude: $resolved — $_" -ForegroundColor Red
    }
}

foreach ($proc in $processExclusions) {
    try {
        Add-MpPreference -ExclusionProcess $proc
        Write-Host "  [OK] Excluded process: $proc" -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] Could not exclude process: $proc — $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done. Current exclusions:" -ForegroundColor Cyan
(Get-MpPreference).ExclusionPath | ForEach-Object { Write-Host "  Path: $_" }
(Get-MpPreference).ExclusionProcess | ForEach-Object { Write-Host "  Process: $_" }
Write-Host ""
Write-Host "You can now build without 'os error 32' failures." -ForegroundColor Green
Write-Host "If issues persist, restart your terminal." -ForegroundColor Yellow
