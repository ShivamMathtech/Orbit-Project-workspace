@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24.x from https://nodejs.org first.
  pause
  exit /b 1
)
node -e "if(process.versions.node.split('.')[0]!=='24'){console.error('Use Node.js 24.x');process.exit(1)}"
if errorlevel 1 goto failed
call npm ci --include=dev
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo Build complete. Run START-WINDOWS.bat to open Orbit.
pause
exit /b 0
:failed
echo Build failed. Read the error above. Check your internet connection and Node.js version.
pause
exit /b 1
