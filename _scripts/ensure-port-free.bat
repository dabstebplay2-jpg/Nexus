@echo off
set "PORT=%~1"
if "%PORT%"=="" exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0free-port.ps1" -Port %PORT%
exit /b %ERRORLEVEL%
