@echo off
setlocal
cd /d "%~dp0"
call npm ci --include=dev
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
call npm test
if errorlevel 1 goto failed
pause
exit /b 0
:failed
echo Tests did not complete. Read the error above.
pause
exit /b 1
