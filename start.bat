@echo off
title NetTrace CDR Intelligence Platform - Launcher
color 0B

echo.
echo  ███╗   ██╗███████╗████████╗████████╗██████╗  █████╗  ██████╗███████╗
echo  ████╗  ██║██╔════╝╚══██╔══╝╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝
echo  ██╔██╗ ██║█████╗     ██║      ██║   ██████╔╝███████║██║     █████╗
echo  ██║╚██╗██║██╔══╝     ██║      ██║   ██╔══██╗██╔══██║██║     ██╔══╝
echo  ██║ ╚████║███████╗   ██║      ██║   ██║  ██║██║  ██║╚██████╗███████╗
echo  ╚═╝  ╚═══╝╚══════╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚══════╝
echo.
echo  [*] CDR Intelligence ^& Network Forensics Platform v2.4
echo  [*] Starting Backend (FastAPI) + Frontend (React/Vite)...
echo  ---------------------------------------------------------------

:: Start FastAPI Backend in a new window
start "NetTrace Backend [Port 8001]" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"

:: Wait 3 seconds for backend to initialize
ping 127.0.0.1 -n 4 >nul

:: Start Vite Frontend in a new window
start "NetTrace Frontend [Port 3000]" cmd /k "cd /d %~dp0frontend && npm.cmd run dev"

:: Wait 4 seconds for frontend to initialize
ping 127.0.0.1 -n 5 >nul

:: Open browser
echo  [*] Opening NetTrace in browser...
start "" "http://localhost:3000"

echo.
echo  ---------------------------------------------------------------
echo  [+] BACKEND  ^>  http://127.0.0.1:8001
echo  [+] FRONTEND ^>  http://localhost:3000
echo  [+] API DOCS ^>  http://127.0.0.1:8001/api/v1/docs
echo  ---------------------------------------------------------------
echo  [!] Close the Backend and Frontend windows to stop the servers.
echo.
pause


:: .\run-server.bat