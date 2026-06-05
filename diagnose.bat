@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_scripts\diagnose.ps1"
echo.
pause
