# PowerShell script to start local development environment
# This script starts XAMPP services and opens two separate PowerShell windows

Write-Host "Starting Local Development Environment..." -ForegroundColor Green

function Test-ListeningPort([int]$Port) {
    return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1)
}

# Start XAMPP services first
Write-Host "Starting XAMPP Apache and MySQL..." -ForegroundColor Yellow
try {
    if (Test-ListeningPort 80) {
        Write-Host "Apache is already listening on port 80; leaving it running." -ForegroundColor DarkYellow
    } else {
        Start-Process "C:\xampp\apache\bin\httpd.exe" -WindowStyle Hidden
        Start-Sleep -Seconds 2
    }

    if (Test-ListeningPort 3306) {
        Write-Host "MySQL is already listening on port 3306; leaving it running." -ForegroundColor DarkYellow
    } else {
        Start-Process "C:\xampp\mysql\bin\mysqld.exe" -WindowStyle Hidden
        Start-Sleep -Seconds 3
    }
    
    Write-Host "XAMPP services started successfully!" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not start XAMPP services automatically. Please start them manually from XAMPP Control Panel." -ForegroundColor Red
}

Write-Host "Opening two PowerShell windows..." -ForegroundColor Yellow

# Resolve paths from this script so the command works from any directory.
$projectRoot = Split-Path -Parent $PSScriptRoot
$dormMartPath = Join-Path $projectRoot "dorm-mart"
if (!(Test-Path (Join-Path $dormMartPath "package.json"))) {
    throw "Could not find dorm-mart/package.json under $projectRoot"
}

# Start React development server in first PowerShell window
if (Test-ListeningPort 3000) {
    Write-Host "React is already listening on port 3000; not starting a duplicate." -ForegroundColor DarkYellow
} else {
    Write-Host "Starting React development server..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$dormMartPath'; Write-Host 'React Dev Server Starting...' -ForegroundColor Green; npm run start-local-win"
}

# Wait a moment for the first window to start
Start-Sleep -Seconds 2

# Start PHP server in second PowerShell window
if (Test-ListeningPort 8080) {
    Write-Host "PHP is already listening on port 8080; not starting a duplicate." -ForegroundColor DarkYellow
} else {
    Write-Host "Starting PHP server..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$dormMartPath'; Write-Host 'PHP Server Starting...' -ForegroundColor Green; C:\xampp\php\php.exe -S localhost:8080 -t ."
}

Write-Host "Two PowerShell windows opened!" -ForegroundColor Green
Write-Host "React app will be available at: http://localhost:3000" -ForegroundColor Yellow
Write-Host "PHP API will be available at: http://localhost:8080" -ForegroundColor Yellow
Write-Host "XAMPP services should be running automatically!" -ForegroundColor Green
