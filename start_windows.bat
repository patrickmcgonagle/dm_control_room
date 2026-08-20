@echo off
setlocal
cd /d "%~dp0"
title DM Control Room

echo ============================================
echo          DM Control Room
 echo ============================================
echo.
echo Starting local server...
echo.

if not exist "%~dp0server.ps1" (
    echo ERROR: server.ps1 was not found.
    echo Make sure you extracted the entire ZIP before running this file.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0data\default_state.json" if not exist "%~dp0data\state.json" (
    echo ERROR: data\default_state.json is missing.
    echo Make sure you extracted the entire release ZIP and did not run this file from inside the ZIP.
    echo.
    pause
    exit /b 1
)

rem Open the browser shortly after the server process begins.
start "" /b powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:8765'"

rem Run the server in THIS window so startup errors remain visible.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
    echo DM Control Room stopped with an error. See the message above.
) else (
    echo DM Control Room has stopped.
)
echo.
pause
exit /b %ERR%
