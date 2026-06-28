@echo off
setlocal
cd /d "%~dp0"

set "REQUESTED_MODE=%~1"
set "ELEVATED_FLAG=%~2"

if /i "%REQUESTED_MODE%"=="local" goto mode_selected
if /i "%REQUESTED_MODE%"=="network" goto mode_selected

echo ==========================================
echo           Belart CRM Launcher
echo ==========================================
echo.
echo Como deseja abrir o projeto?
echo [L] Localmente (127.0.0.1)
echo [R] Liberar acesso na rede local
echo.

choice /c LR /n /m "Escolha L ou R: "
if errorlevel 2 (
  set "REQUESTED_MODE=network"
) else (
  set "REQUESTED_MODE=local"
)

:mode_selected
if /i "%REQUESTED_MODE%"=="network" (
  net session >nul 2>&1
  if errorlevel 1 (
    if /i not "%ELEVATED_FLAG%"=="elevated" (
      echo.
      echo Solicitando permissao de administrador para liberar a rede...
      powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList 'network elevated' -Verb RunAs"
      set "EXITCODE=%ERRORLEVEL%"
      endlocal & exit /b %EXITCODE%
    )
  )

  echo.
  echo Liberando a porta 3000 no Firewall do Windows para testes na rede...
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { if (-not (Get-NetFirewallRule -DisplayName 'Belart CRM 3000' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'Belart CRM 3000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 | Out-Null } } catch { Write-Host $_.Exception.Message; exit 1 }"
  if errorlevel 1 (
    echo.
    echo Nao foi possivel liberar a porta 3000 automaticamente.
    echo Execute este iniciador como administrador ou libere a porta manualmente no Firewall.
    pause
    endlocal & exit /b 1
  )
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-belart-crm.ps1" -Mode %REQUESTED_MODE%
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo O iniciador encontrou um problema. Veja as mensagens acima.
  pause
)

endlocal & exit /b %EXITCODE%
