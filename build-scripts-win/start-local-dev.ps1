# PowerShell script to start local development environment
# This script starts XAMPP services and opens two separate PowerShell windows

Write-Host "Starting Local Development Environment..." -ForegroundColor Green

# Start XAMPP services first
Write-Host "Starting XAMPP Apache and MySQL..." -ForegroundColor Yellow
try {
    # Start Apache
    Start-Process "C:\xampp\apache\bin\httpd.exe" -WindowStyle Hidden
    Start-Sleep -Seconds 2
    
    # Start MySQL
    Start-Process "C:\xampp\mysql\bin\mysqld.exe" -WindowStyle Hidden
    Start-Sleep -Seconds 3
    
    Write-Host "XAMPP services started successfully!" -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not start XAMPP services automatically. Please start them manually from XAMPP Control Panel." -ForegroundColor Red
}

Write-Host "Opening two PowerShell windows..." -ForegroundColor Yellow

# Get the current directory (should be the project root)
$projectRoot = Get-Location
$dormMartPath = Join-Path $projectRoot "dorm-mart"

# Start React development server in first PowerShell window
Write-Host "Starting React development server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$dormMartPath'; Write-Host 'React Dev Server Starting...' -ForegroundColor Green; npm run start-local-win"

# Wait a moment for the first window to start
Start-Sleep -Seconds 2

# Start PHP server in second PowerShell window
Write-Host "Starting PHP server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$dormMartPath'; Write-Host 'PHP Server Starting...' -ForegroundColor Green; C:\xampp\php\php.exe -S localhost:8080 -t ."

Write-Host "Two PowerShell windows opened!" -ForegroundColor Green
Write-Host "React app will be available at: http://localhost:3000" -ForegroundColor Yellow
Write-Host "PHP API will be available at: http://localhost:8080" -ForegroundColor Yellow
Write-Host "XAMPP services should be running automatically!" -ForegroundColor Green
