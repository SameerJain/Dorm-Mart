@echo off
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-railway-current.ps1" %*
