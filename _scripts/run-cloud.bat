@echo off
call "%~dp0resolve-python.bat"
if errorlevel 1 exit /b 1
call "%~dp0ensure-port-free.bat" 8080
if errorlevel 1 (
    echo Port 8080 busy. Run stop-all.bat
    pause
    exit /b 1
)
"%NEXUS_PYTHON%" "%~dp0serve-cloud.py"
