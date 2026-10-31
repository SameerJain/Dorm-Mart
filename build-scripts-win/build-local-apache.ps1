# PowerShell script for Build Method 2: Local Apache simulation
# This script builds the React app, copies files to XAMPP htdocs/serve, and starts PHP server

Write-Host "Starting Build Method 2: Local Apache Simulation..." -ForegroundColor Green

Write-Host "Starting XAMPP Apache and MySQL..." -ForegroundColor Yellow
try {
    Start-Process "C:\xampp\apache\bin\httpd.exe" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    
    Start-Process "C:\xampp\mysql\bin\mysqld.exe" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    
    Write-Host "XAMPP services started successfully!" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not start XAMPP services automatically. Please start them manually from XAMPP Control Panel." -ForegroundColor Red
}

# Resolve paths from this script so the command works from any directory.
$projectRoot = Split-Path -Parent $PSScriptRoot
$dormMartPath = Join-Path $projectRoot "dorm-mart"
$servePath = "C:\xampp\htdocs\serve"

Write-Host "Building React app..." -ForegroundColor Cyan
Set-Location $dormMartPath
if (Test-Path (Join-Path $dormMartPath "build")) {
    Remove-Item -LiteralPath (Join-Path $dormMartPath "build") -Recurse -Force
}
npm run build-local-win
if ($LASTEXITCODE -ne 0) {
    throw "React local build failed with exit code $LASTEXITCODE"
}

Write-Host "Creating/clearing serve directory..." -ForegroundColor Yellow
if (!(Test-Path $servePath)) {
    New-Item -ItemType Directory -Path $servePath -Force
} else {
    Remove-Item -Path "$servePath\*" -Recurse -Force
    Write-Host "Cleared existing serve directory" -ForegroundColor Yellow
}

$dormMartServePath = Join-Path $servePath "dorm-mart"
New-Item -ItemType Directory -Path $dormMartServePath -Force
Write-Host "Created dorm-mart subfolder in serve directory" -ForegroundColor Yellow

Write-Host "Copying files to dorm-mart subfolder..." -ForegroundColor Yellow

Write-Host "Copying api folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\api" -Destination $dormMartServePath -Recurse -Force

Write-Host "Copying data folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\data" -Destination $dormMartServePath -Recurse -Force

Write-Host "Copying schema folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\schema" -Destination $dormMartServePath -Recurse -Force

Write-Host "Copying vendor folder..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\vendor" -Destination $dormMartServePath -Recurse -Force

Write-Host "Copying .env.local file..." -ForegroundColor Cyan
Copy-Item -Path "$dormMartPath\.env.local" -Destination $dormMartServePath -Force

Write-Host "Copying build contents..." -ForegroundColor Cyan
$buildPath = Join-Path $dormMartPath "build"
if (Test-Path $buildPath) {
    Get-ChildItem -Path $buildPath | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination $dormMartServePath -Recurse -Force
    }
    Write-Host "Build contents copied successfully!" -ForegroundColor Green
} else {
    Write-Host "Warning: Build folder not found. Make sure the build completed successfully." -ForegroundColor Red
}

Write-Host "Starting PHP server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$servePath'; Write-Host 'PHP Server Starting from serve directory...' -ForegroundColor Green; C:\xampp\php\php.exe -S localhost:8080 -t ."

Write-Host "Build Method 2 completed!" -ForegroundColor Green
Write-Host "Your app is now available at: http://localhost/serve/dorm-mart" -ForegroundColor Yellow
Write-Host "PHP API is available at: http://localhost:8080" -ForegroundColor Yellow
Write-Host "Don't forget to run: php api/database/migrate_schema.php from the serve/dorm-mart directory" -ForegroundColor Red
