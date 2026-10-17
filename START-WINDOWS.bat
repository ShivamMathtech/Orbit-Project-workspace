@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 24.x from https://nodejs.org
  echo Then close this window and double-click START-WINDOWS.bat again.
  pause
  exit /b 1
)
node scripts\start.mjs --open
if errorlevel 1 echo Startup failed. Read the error above for the next step.
pause
