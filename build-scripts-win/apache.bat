@echo off
echo Starting Apache build process...
powershell -ExecutionPolicy Bypass -File "%~dp0build-local-apache.ps1"
pause