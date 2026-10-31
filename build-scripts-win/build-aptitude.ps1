# PowerShell script for Aptitude Production Build
# This script builds the React app and copies files to prod-build directory for WinSCP upload

Write-Host "Starting Aptitude Production Build..." -ForegroundColor Green

# Resolve paths from this script so the command works from any directory.
$projectRoot = Split-Path -Parent $PSScriptRoot
$dormMartPath = Join-Path $projectRoot "dorm-mart"
$prodBuildPath = "C:\xampp\htdocs\prod-build"

Write-Host "Building React app for production..." -ForegroundColor Cyan
Set-Location $dormMartPath
if (Test-Path (Join-Path $dormMartPath "build")) {
    Remove-Item -LiteralPath (Join-Path $dormMartPath "build") -Recurse -Force
}
npm run build-prod-win
if ($LASTEXITCODE -ne 0) {
    throw "React Aptitude build failed with exit code $LASTEXITCODE"
}

Write-Host "Creating prod-build directory..." -ForegroundColor Yellow
if (!(Test-Path $prodBuildPath)) {
    New-Item -ItemType Directory -Path $prodBuildPath -Force
} else {
    Remove-Item -Path "$prodBuildPath\*" -Recurse -Force
    Write-Host "Cleared existing prod-build directory" -ForegroundColor Yellow
}

Write-Host "Copying files to prod-build directory..." -ForegroundColor Yellow

Write-Host "Copying api folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\api" -Destination $prodBuildPath -Recurse -Force

Write-Host "Copying data folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\data" -Destination $prodBuildPath -Recurse -Force

Write-Host "Copying schema folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\schema" -Destination $prodBuildPath -Recurse -Force

Write-Host "Copying vendor folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\vendor" -Destination $prodBuildPath -Recurse -Force

Write-Host "Copying .env.production file..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\.env.production" -Destination $prodBuildPath -Force

Write-Host "Copying build contents..." -ForegroundColor Cyan
$buildPath = Join-Path $dormMartPath "build"
if (Test-Path $buildPath) {
    Get-ChildItem -Path $buildPath | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $prodBuildPath -Recurse -Force
    }
    Write-Host "Build contents copied successfully!" -ForegroundColor Green
} else {
    Write-Host "Warning: Build folder not found. Make sure the build completed successfully." -ForegroundColor Red
}

Write-Host "Aptitude Production Build completed!" -ForegroundColor Green
Write-Host "All files are ready in: C:\xampp\htdocs\prod-build" -ForegroundColor Yellow
Write-Host "You can now upload this entire folder to Aptitude using WinSCP" -ForegroundColor Cyan
Write-Host "Don't forget to run: php api/database/migrate_schema.php on the server after upload!" -ForegroundColor Red
