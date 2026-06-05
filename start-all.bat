@echo off
rem Nexus Pro - start Cloud (8080), Backend (8000), Frontend (5173)
rem Open: http://localhost:5173
rem Help: ZAPUSK.txt

cd /d "%~dp0"
call "%~dp0_scripts\resolve-python.bat"
if errorlevel 1 pause & exit /b 1

echo.
echo [Nexus Pro] Free ports 8080, 8000, 5173 (old processes)...
call "%~dp0_scripts\kill-ports.bat"
timeout /t 2 /nobreak >nul

echo [Nexus Pro] Starting Cloud, then Backend, then Frontend...
echo.

start "Nexus Cloud 8080" cmd /k call "%~dp0_scripts\run-cloud.bat"
timeout /t 4 /nobreak >nul
start "Nexus Backend 8000" cmd /k call "%~dp0_scripts\run-backend.bat"
timeout /t 2 /nobreak >nul
start "Nexus Frontend 5173" cmd /k call "%~dp0_scripts\run-frontend.bat"

echo.
echo Done. Open: http://localhost:5173
echo.
echo CHECK window "Nexus Cloud 8080":
echo   OK  = Uvicorn running on http://127.0.0.1:8080
echo   BAD = error 10048 (port busy) - run stop-all.bat and try again
echo.
pause
