@echo off
call "%~dp0resolve-python.bat"
if errorlevel 1 exit /b 1
call "%~dp0ensure-port-free.bat" 8000
if errorlevel 1 (
    echo.
    echo Port 8000 is still busy. Run stop-all.bat or diagnose.bat
    pause
    exit /b 1
)
cd /d "%~dp0..\backend"
rem Python launcher: checks port, no --reload, fallback 8001/8002
"%NEXUS_PYTHON%" "%~dp0serve-backend.py"
