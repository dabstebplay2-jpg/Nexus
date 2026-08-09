@echo off
setlocal
cd /d "%~dp0"
title Nexus Launcher

if not exist "venv\Scripts\python.exe" goto install
if not exist "frontend\node_modules" goto install
goto start

:install
echo [Nexus] First run: installing dependencies...
call "%~dp0nexus.bat" install -NoPause
if errorlevel 1 goto fail

:start
call "%~dp0nexus.bat" start -NoPause
if errorlevel 1 goto fail
exit /b 0

:fail
echo.
echo Nexus could not start. Read the error above.
pause
exit /b 1
