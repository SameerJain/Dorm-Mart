# PowerShell script for Aptitude Production Build
# This script builds the React app and copies files to prod-build directory for WinSCP upload

Write-Host "Starting Aptitude Production Build..." -ForegroundColor Green

# Get the current directory (should be the project root)
$projectRoot = Get-Location
$dormMartPath = Join-Path $projectRoot "dorm-mart"
$prodBuildPath = "C:\xampp\htdocs\prod-build"

Write-Host "Building React app for production..." -ForegroundColor Cyan
# Change to dorm-mart directory and build
Set-Location $dormMartPath
npm run build-prod-win

Write-Host "Creating prod-build directory..." -ForegroundColor Yellow
# Create prod-build directory if it doesn't exist
if (!(Test-Path $prodBuildPath)) {
    New-Item -ItemType Directory -Path $prodBuildPath -Force
} else {
    # Clear existing directory
    Remove-Item -Path "$prodBuildPath\*" -Recurse -Force
    Write-Host "Cleared existing prod-build directory" -ForegroundColor Yellow
}

Write-Host "Copying files to prod-build directory..." -ForegroundColor Yellow

# Copy API folder
Write-Host "Copying api folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\api" -Destination $prodBuildPath -Recurse -Force

# Copy data folder
Write-Host "Copying data folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\data" -Destination $prodBuildPath -Recurse -Force

# Copy migrations folder
Write-Host "Copying migrations folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\migrations" -Destination $prodBuildPath -Recurse -Force

# Copy vendor folder
Write-Host "Copying vendor folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\vendor" -Destination $prodBuildPath -Recurse -Force

# Copy .env.production file
Write-Host "Copying .env.production file..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\.env.production" -Destination $prodBuildPath -Force

# Copy build contents (not the build folder itself)
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
Write-Host "Don't forget to run migrations on the server after upload!" -ForegroundColor Red
