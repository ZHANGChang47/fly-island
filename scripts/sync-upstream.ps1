<#
.SYNOPSIS
    Developer-only: pull and merge the latest changes from the upstream
    flyl1u/fly-island repository into this local working copy.

.DESCRIPTION
    This script is NOT shipped to end users and is NOT wired to any UI button.
    It exists for developers who work on this fork locally. End users update
    through the in-app "Check for updates" button, which downloads a signed
    installer from the releases endpoint (see docs/updater.md).

    What it does:
      1. Verifies the upstream remote exists, adding it if missing.
      2. Fetches the upstream main branch (no auto-merge).
      3. Attempts a merge into the current branch. Local custom code
         (file preview, global file search, glass styling) may conflict;
         resolve those conflicts manually with a git merge tool.

    Requirements: git in PATH, network access to github.com.

.EXAMPLE
    .\scripts\sync-upstream.ps1
    .\scripts\sync-upstream.ps1 -DryRun
#>
param(
    [switch]$DryRun,
    [string]$RemoteName = 'upstream',
    [string]$UpstreamUrl = 'https://github.com/flyl1u/fly-island.git'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Step($msg) { Write-Host "[sync] $msg" -ForegroundColor Cyan }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'git not found in PATH.'
}

$current = git rev-parse --abbrev-ref HEAD
if ($LASTEXITCODE -ne 0) { throw 'Not inside a git repository.' }
Write-Step "current branch: $current"

$existing = git remote get-url $RemoteName 2>$null
if (-not $existing) {
    if ($DryRun) { Write-Step "DRY-RUN: would add remote $RemoteName -> $UpstreamUrl" }
    else {
        git remote add $RemoteName $UpstreamUrl
        Write-Step "added remote $RemoteName"
    }
} else {
    Write-Step "remote $RemoteName already points to: $existing"
}

if ($DryRun) {
    Write-Step 'DRY-RUN: would fetch upstream/main and merge into current branch.'
    Write-Step 'No changes made.'
    exit 0
}

Write-Step 'fetching upstream/main ...'
git fetch $RemoteName main
if ($LASTEXITCODE -ne 0) { throw 'git fetch failed. Check network / proxy settings.' }

Write-Step 'merging upstream/main into current branch ...'
git merge --no-edit "$RemoteName/main"
if ($LASTEXITCODE -ne 0) {
    Write-Warning 'Merge stopped with conflicts (or local changes). Resolve manually, then: git add -A; git commit'
    exit 2
}

Write-Step 'merge completed. Review: git log --oneline -5'
