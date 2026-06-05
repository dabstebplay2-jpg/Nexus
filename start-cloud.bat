@echo off
cd /d "%~dp0"
call "%~dp0_scripts\resolve-python.bat"
if errorlevel 1 pause & exit /b 1
call "%~dp0_scripts\run-cloud.bat"
pause
