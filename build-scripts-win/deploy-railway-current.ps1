# PowerShell script for deploying the current local Dorm Mart code to Railway.
# Requires Railway CLI: npm install -g @railway/cli

param(
    [Parameter(Position = 0)]
    [string]$Note = "",
    [string]$Service = "",
    [string]$Environment = "",
    [switch]$Ci,
    [switch]$Detach,
    [switch]$RequireClean
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$dormMartPath = Join-Path $projectRoot "dorm-mart"

if (!(Test-Path $dormMartPath)) {
    Write-Host "Could not find dorm-mart folder. Run this script from the repo root." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host "Railway CLI is not installed or not on PATH." -ForegroundColor Red
    Write-Host "Install it with: npm install -g @railway/cli" -ForegroundColor Yellow
    Write-Host "Then login/link once with: railway login && railway link" -ForegroundColor Yellow
    exit 1
}

$minimumRailwayVersion = [version]"4.30.5"
$railwayVersionRaw = (& railway --version 2>$null) -join " "
$railwayVersionMatch = [regex]::Match($railwayVersionRaw, '\d+\.\d+\.\d+')

if (-not $railwayVersionMatch.Success) {
    Write-Host "Could not determine the Railway CLI version." -ForegroundColor Red
    Write-Host "Run: npm update -g @railway/cli" -ForegroundColor Yellow
    exit 1
}

$railwayVersion = [version]$railwayVersionMatch.Value
if ($railwayVersion -lt $minimumRailwayVersion) {
    Write-Host "Railway CLI $railwayVersion has a known railway up upload bug." -ForegroundColor Red
    Write-Host "Version $minimumRailwayVersion or newer is required." -ForegroundColor Yellow
    Write-Host "Run: npm update -g @railway/cli" -ForegroundColor Yellow
    exit 1
}

if ($Ci -and $Detach) {
    Write-Host "Use either -Ci or -Detach, not both." -ForegroundColor Red
    exit 1
}

$railwayUserRaw = & railway whoami 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($railwayUserRaw)) {
    Write-Host "Railway CLI is not logged in, or your session token is expired." -ForegroundColor Red
    Write-Host "Run: railway login" -ForegroundColor Yellow
    Write-Host "Then link the project/service if needed: railway link" -ForegroundColor Yellow
    exit 1
}
$railwayUser = (($railwayUserRaw -join " ") -replace '[^\x20-\x7E]', '').Trim()

Write-Host "Railway user: $railwayUser" -ForegroundColor Magenta
Write-Host "Railway CLI: $railwayVersion" -ForegroundColor Magenta

if ([string]::IsNullOrWhiteSpace($Note)) {
    $Note = "Railway Test"
}

if (Get-Command git -ErrorAction SilentlyContinue) {
    $branch = git rev-parse --abbrev-ref HEAD 2>$null
    $commit = git rev-parse --short HEAD 2>$null
    $commitSubject = git log -1 --pretty=%s 2>$null
    $dirty = git status --short

    if ($branch) { Write-Host "Current branch: $branch" -ForegroundColor Cyan }
    if ($commit) { Write-Host "Last local commit: $commit - $commitSubject" -ForegroundColor Cyan }

    if ($dirty) {
        $dirtyCount = @($dirty).Count
        if ($dirtyCount -gt 12) {
            Write-Host "Many uncommitted files detected ($dirtyCount files). They will be included in this local Railway upload." -ForegroundColor Yellow
            Write-Host "Run 'git status --short' separately if you want the full list." -ForegroundColor Yellow
        } else {
            Write-Host "Uncommitted files that will be included in this local Railway upload:" -ForegroundColor Yellow
            $dirty | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
        }
        if ($RequireClean) {
            Write-Host "Stopping because -RequireClean was provided." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "No uncommitted Git changes detected; upload matches the last local commit contents." -ForegroundColor Green
    }
} else {
    Write-Host "Git was not found on PATH, so no local commit/dirty-file summary was shown." -ForegroundColor Yellow
}

$argsList = @("up", $dormMartPath, "--message", $Note)

if ($Ci) {
    $argsList += "--ci"
} elseif ($Detach) {
    $argsList += "--detach"
}

if ($Service -ne "") {
    $argsList += @("--service", $Service)
}

if ($Environment -ne "") {
    $argsList += @("--environment", $Environment)
}

Write-Host "Deploying dorm-mart to Railway..." -ForegroundColor DarkBlue
Write-Host "Command: railway $($argsList -join ' ')" -ForegroundColor DarkGray

& railway @argsList

if ($LASTEXITCODE -ne 0) {
    Write-Host "Railway deploy failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Deploy note: $Note" -ForegroundColor Magenta
if ($Detach) {
    Write-Host "Railway deploy was queued. The build is still running remotely." -ForegroundColor Green
} else {
    Write-Host "Railway deploy completed successfully." -ForegroundColor Green
}
