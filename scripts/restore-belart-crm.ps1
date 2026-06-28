param(
  [string]$Source = "",
  [switch]$RestoreEnv
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib\belart-portability.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$paths = Get-BelartProjectPaths -ProjectRoot $projectRoot

if (-not $Source) {
  $Source = Get-LatestBackupSource -BackupsDir $paths.BackupsDir
  if (-not $Source) {
    throw "Nenhum backup encontrado em $($paths.BackupsDir)."
  }
}

$resolvedSource = Resolve-AbsolutePath -BasePath $projectRoot -Path $Source
if (-not (Test-Path $resolvedSource)) {
  throw "Backup nao encontrado em $resolvedSource."
}

$workingDir = $resolvedSource
$tempExtractDir = $null

Write-Host ""
Write-Host "Belart CRM - Restauracao de backup" -ForegroundColor Green
Write-Host ""

if ((Get-Item $resolvedSource).Extension -eq ".zip") {
  Write-Step "Extraindo backup zip"
  $tempExtractDir = Join-Path $paths.RuntimeDir "restore-temp-$(New-Timestamp)"
  Ensure-Directory -Path $tempExtractDir
  Expand-Archive -Path $resolvedSource -DestinationPath $tempExtractDir -Force
  $workingDir = $tempExtractDir
}

$manifestPath = Join-Path $workingDir "manifest.json"
$hasEnvInBackup = Test-Path (Join-Path $workingDir "config\.env.local")

if ((-not $RestoreEnv) -and $hasEnvInBackup) {
  $answer = Read-Host "Restaurar tambem o .env.local deste backup? (s/N)"
  if ($answer -match "^(s|sim|y|yes)$") {
    $RestoreEnv = $true
  }
}

Write-Step "Encerrando servicos do projeto"
Stop-ManagedProcess -PidFile $paths.CrmPidFile
Stop-ProjectServerOnPort -Port 3000 -ProjectRoot $projectRoot

Write-Step "Restaurando dados do projeto"
if (Reset-DirectoryFromSource -Source (Join-Path $workingDir "project\data") -Destination $paths.DataDir) {
  Write-Info "Pasta data restaurada."
} else {
  Write-Warn "Nenhum dado local encontrado no backup."
}

if ($RestoreEnv -and $hasEnvInBackup) {
  Write-Step "Restaurando configuracao local"
  Copy-Item -Path (Join-Path $workingDir "config\.env.local") -Destination $paths.EnvFile -Force
  Write-Info ".env.local restaurado."
}

if ($manifestPath -and (Test-Path $manifestPath)) {
  $manifest = Get-Content -Path $manifestPath | ConvertFrom-Json
  Write-Info "Backup criado em $($manifest.createdAt) na maquina $($manifest.machine)."
}

if ($tempExtractDir -and (Test-Path $tempExtractDir)) {
  Remove-Item $tempExtractDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Restauracao concluida." -ForegroundColor Green
Write-Host "Reabra o projeto com iniciar.bat para validar o ambiente." -ForegroundColor Green
Write-Host ""
