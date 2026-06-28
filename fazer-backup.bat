@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup-belart-crm.ps1"
set EXITCODE=%ERRORLEVEL%
if not "%EXITCODE%"=="0" (
  echo.
  echo O backup encontrou um problema. Veja as mensagens acima.
  pause
)
endlocal & exit /b %EXITCODE%

