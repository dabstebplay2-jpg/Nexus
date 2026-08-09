@echo off
setlocal
cd /d "%~dp0"
call "%~dp0nexus.bat" stop -NoPause
endlocal
