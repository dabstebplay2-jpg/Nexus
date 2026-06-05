@echo off
cd /d "%~dp0"
call "%~dp0_scripts\resolve-python.bat"
if errorlevel 1 pause & exit /b 1

echo.
echo === Nexus Pro: install dependencies ===
echo.

echo [1/3] nexus-cloud-server
"%NEXUS_PYTHON%" -m pip install -r "%~dp0nexus-cloud-server\requirements.txt"
if errorlevel 1 goto err

echo.
echo [2/3] backend
"%NEXUS_PYTHON%" -m pip install -r "%~dp0backend\requirements.txt"
if errorlevel 1 goto err

echo.
echo [3/3] frontend
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 goto err

echo.
echo OK. Run start-all.bat
pause
exit /b 0

:err
echo.
echo Install failed. Check Python and Node in PATH.
pause
exit /b 1
