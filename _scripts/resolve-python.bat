@echo off
set "NEXUS_PYTHON="
if exist "%~dp0..\venv\Scripts\python.exe" (
    set "NEXUS_PYTHON=%~dp0..\venv\Scripts\python.exe"
)
if not defined NEXUS_PYTHON (
    where python >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python not found. Install Python 3.10+ or run: python -m venv venv
        exit /b 1
    )
    set "NEXUS_PYTHON=python"
)
exit /b 0
