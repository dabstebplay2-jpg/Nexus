@echo off
setlocal
cd /d "%~dp0nexus-cloud-server"
set "CLOUD=%NEXUS_PRODUCTION_CLOUD_URL%"
if "%CLOUD%"=="" set "CLOUD=https://nexus-cloud-ee17.onrender.com"
python scripts\smoke_test_render.py "%CLOUD%"
echo.
pause
