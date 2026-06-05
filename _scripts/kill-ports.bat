@echo off
rem Kill listeners on Nexus ports (no pause)
for %%P in (5173 8000 8080) do call "%~dp0ensure-port-free.bat" %%P
