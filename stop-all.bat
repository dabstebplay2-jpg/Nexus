@echo off
echo Stopping Nexus Pro (ports 5173, 8000, 8080)...
call "%~dp0_scripts\kill-ports.bat"
if errorlevel 1 echo Warning: some ports may still be busy.
timeout /t 2 /nobreak >nul
echo Done. You can run start-all.bat
pause
