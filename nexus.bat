@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%~dp0"
set "SCRIPTS=%ROOT%_scripts\"

if "%~1"=="" goto menu

if /i "%~1"=="help" goto help
if /i "%~1"=="-?" goto help
if /i "%~1"=="--help" goto help
if /i "%~1"=="install" goto install_deps
if /i "%~1"=="install-deps" goto install_deps
if /i "%~1"=="start" goto start_all
if /i "%~1"=="start-all" goto start_all
if /i "%~1"=="cloud" goto cmd_cloud
if /i "%~1"=="start-cloud" goto cmd_cloud
if /i "%~1"=="backend" goto cmd_backend
if /i "%~1"=="start-backend" goto cmd_backend
if /i "%~1"=="frontend" goto cmd_frontend
if /i "%~1"=="start-frontend" goto cmd_frontend
if /i "%~1"=="stop" goto stop_all
if /i "%~1"=="stop-all" goto stop_all
if /i "%~1"=="diagnose" goto diagnose
if /i "%~1"=="_run-cloud" goto run_cloud
if /i "%~1"=="_run-backend" goto run_backend
if /i "%~1"=="_run-frontend" goto run_frontend

echo Unknown command: %~1
goto help

:menu
echo.
echo Nexus Pro launcher
echo   1  install     dependencies (once)
echo   2  start       cloud + backend + frontend
echo   3  cloud       API port 8080
echo   4  backend     proxy port 8000
echo   5  frontend    UI port 5173
echo   6  stop        free ports 5173, 8000, 8080
echo   7  diagnose    ports and health
echo   8  help
echo   Q  quit
echo.
set "CHOICE="
set /p CHOICE=Select [1-8 or Q]: 
if /i "%CHOICE%"=="1" goto install_deps
if /i "%CHOICE%"=="2" goto start_all
if /i "%CHOICE%"=="3" goto cmd_cloud
if /i "%CHOICE%"=="4" goto cmd_backend
if /i "%CHOICE%"=="5" goto cmd_frontend
if /i "%CHOICE%"=="6" goto stop_all
if /i "%CHOICE%"=="7" goto diagnose
if /i "%CHOICE%"=="8" goto help
if /i "%CHOICE%"=="Q" exit /b 0
if "%CHOICE%"=="" goto menu
echo Invalid choice.
goto menu

:help
echo.
echo Usage: nexus.bat [command]
echo.
echo   install       pip + npm dependencies
echo   start         start cloud, backend, frontend (new windows)
echo   cloud           cloud API on 8080
echo   backend         local proxy on 8000
echo   frontend        Vite UI on 5173
echo   stop            kill listeners on 5173, 8000, 8080
echo   diagnose        port check and health
echo.
echo Open: http://localhost:5173
echo Help: ZAPUSK.txt
echo.
if "%~1"=="" pause
exit /b 0

:install_deps
call :resolve_python
if errorlevel 1 goto pause_fail
echo.
echo === Nexus Pro: install dependencies ===
echo.
echo [1/3] nexus-cloud-server
"%NEXUS_PYTHON%" -m pip install -r "%ROOT%nexus-cloud-server\requirements.txt"
if errorlevel 1 goto install_err
echo.
echo [2/3] backend
"%NEXUS_PYTHON%" -m pip install -r "%ROOT%backend\requirements.txt"
if errorlevel 1 goto install_err
echo.
echo [3/3] frontend
cd /d "%ROOT%frontend"
call npm install
if errorlevel 1 goto install_err
echo.
echo OK. Run: nexus.bat start
pause
exit /b 0

:install_err
echo.
echo Install failed. Check Python and Node in PATH.
pause
exit /b 1

:start_all
call :resolve_python
if errorlevel 1 goto pause_fail
echo.
echo [Nexus Pro] Free ports 8080, 8000, 5173...
call :kill_ports
timeout /t 2 /nobreak >nul
echo [Nexus Pro] Starting Cloud, Backend, Frontend...
echo.
start "Nexus Cloud 8080" cmd /k call "%ROOT%nexus.bat" _run-cloud
timeout /t 4 /nobreak >nul
start "Nexus Backend 8000" cmd /k call "%ROOT%nexus.bat" _run-backend
timeout /t 2 /nobreak >nul
start "Nexus Frontend 5173" cmd /k call "%ROOT%nexus.bat" _run-frontend
echo.
echo Done. Open: http://localhost:5173
echo.
echo CHECK window "Nexus Cloud 8080":
echo   OK  = Uvicorn running on http://127.0.0.1:8080
echo   BAD = error 10048 (port busy) - run: nexus.bat stop
echo.
pause
exit /b 0

:cmd_cloud
call :run_cloud
if errorlevel 1 pause
exit /b %ERRORLEVEL%

:cmd_backend
call :resolve_python
if errorlevel 1 goto pause_fail
call :run_backend
if errorlevel 1 pause
exit /b %ERRORLEVEL%

:cmd_frontend
call :run_frontend
if errorlevel 1 pause
exit /b %ERRORLEVEL%

:run_cloud
call :resolve_python
if errorlevel 1 exit /b 1
call :ensure_port_free 8080
if errorlevel 1 (
    echo Port 8080 busy. Run: nexus.bat stop
    pause
    exit /b 1
)
"%NEXUS_PYTHON%" "%SCRIPTS%serve-cloud.py"
exit /b %ERRORLEVEL%

:run_backend
call :resolve_python
if errorlevel 1 exit /b 1
call :ensure_port_free 8000
if errorlevel 1 (
    echo.
    echo Port 8000 is still busy. Run: nexus.bat stop
    pause
    exit /b 1
)
cd /d "%ROOT%backend"
"%NEXUS_PYTHON%" "%SCRIPTS%serve-backend.py"
exit /b %ERRORLEVEL%

:run_frontend
call :ensure_port_free 5173
cd /d "%ROOT%frontend"
if not exist "node_modules\" (
    echo npm install...
    call npm install
)
echo Nexus Frontend: http://localhost:5173
npm run dev
exit /b %ERRORLEVEL%

:stop_all
echo Stopping Nexus Pro (ports 5173, 8000, 8080)...
call :kill_ports
if errorlevel 1 echo Warning: some ports may still be busy.
timeout /t 2 /nobreak >nul
echo Done. Run: nexus.bat start
pause
exit /b 0

:diagnose
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS%diagnose.ps1"
echo.
pause
exit /b 0

:pause_fail
pause
exit /b 1

:resolve_python
set "NEXUS_PYTHON="
if exist "%ROOT%venv\Scripts\python.exe" (
    set "NEXUS_PYTHON=%ROOT%venv\Scripts\python.exe"
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

:ensure_port_free
set "PORT=%~1"
if "%PORT%"=="" exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPTS%free-port.ps1" -Port %PORT%
exit /b %ERRORLEVEL%

:kill_ports
for %%P in (5173 8000 8080) do call :ensure_port_free %%P
exit /b 0
