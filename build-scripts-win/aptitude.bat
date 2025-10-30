@echo off
echo Starting Aptitude production build...
powershell -ExecutionPolicy Bypass -File "%~dp0build-aptitude.ps1"
pause
