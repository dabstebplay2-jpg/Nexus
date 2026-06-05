@echo off
call "%~dp0ensure-port-free.bat" 5173
cd /d "%~dp0..\frontend"
if not exist "node_modules\" (
    echo npm install...
    call npm install
)
echo Nexus Frontend: http://localhost:5173
npm run dev
