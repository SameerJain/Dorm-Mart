# PowerShell script for deploying the current local Dorm Mart code to Railway.
# Requires Railway CLI: npm install -g @railway/cli

param(
    [string]$Service = "",
    [string]$Environment = "",
    [switch]$Ci
)

$ErrorActionPreference = "Stop"

Write-Host "Preparing Railway deploy from current local code..." -ForegroundColor Green

$projectRoot = Get-Location
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

$railwayUser = & railway whoami 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($railwayUser)) {
    Write-Host "Railway CLI is not logged in, or your session token is expired." -ForegroundColor Red
    Write-Host "Run: railway login" -ForegroundColor Yellow
    Write-Host "Then link the project/service if needed: railway link" -ForegroundColor Yellow
    exit 1
}

Write-Host "Railway user: $railwayUser" -ForegroundColor Cyan
Write-Host "Railway CLI deploys the local dorm-mart directory contents. This script does not read from or modify Git." -ForegroundColor Yellow

$argsList = @("up", $dormMartPath)

if ($Ci) {
    $argsList += "--ci"
} else {
    $argsList += "--detach"
}

if ($Service -ne "") {
    $argsList += @("--service", $Service)
}

if ($Environment -ne "") {
    $argsList += @("--environment", $Environment)
}

Write-Host "Deploying dorm-mart to Railway..." -ForegroundColor Cyan
Write-Host "Command: railway $($argsList -join ' ')" -ForegroundColor DarkGray

& railway @argsList

if ($LASTEXITCODE -ne 0) {
    Write-Host "Railway deploy failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Railway deploy started successfully." -ForegroundColor Green
