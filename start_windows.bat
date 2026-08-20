@echo off
setlocal
cd /d "%~dp0"

echo Starting DM Control Room...
start "DM Control Room Server" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8765"
exit /b
