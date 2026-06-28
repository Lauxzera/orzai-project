param(
  [switch]$WithoutEnv
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib\belart-portability.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$paths = Get-BelartProjectPaths -ProjectRoot $projectRoot
$timestamp = New-Timestamp
$backupName = "belart-crm-backup-$timestamp"
$backupDir = Join-Path $paths.BackupsDir $backupName
$zipPath = "$backupDir.zip"

Write-Host ""
Write-Host "Belart CRM - Backup operacional" -ForegroundColor Green
Write-Host ""

Write-Step "Preparando estrutura de backup"
Ensure-Directory -Path $paths.BackupsDir
Ensure-Directory -Path $backupDir

$copiedItems = [System.Collections.Generic.List[string]]::new()

Write-Step "Copiando dados do projeto"
if (Copy-PathIfExists -Source $paths.DataDir -Destination (Join-Path $backupDir "project\data")) {
  $copiedItems.Add("project/data")
  Write-Info "Dados locais copiados."
} else {
  Write-Warn "Pasta data nao encontrada."
}

if (-not $WithoutEnv -and (Test-Path $paths.EnvFile)) {
  Write-Step "Copiando configuracao local"
  Copy-PathIfExists -Source $paths.EnvFile -Destination (Join-Path $backupDir "config\.env.local") | Out-Null
  $copiedItems.Add("config/.env.local")
  Write-Info ".env.local incluido no backup."
}

$manifest = [ordered]@{
  project = "Belart CRM"
  createdAt = (Get-Date).ToString("o")
  machine = $env:COMPUTERNAME
  user = $env:USERNAME
  databaseUrlConfigured = [bool](Read-EnvValue -FilePath $paths.EnvFile -Name "DATABASE_URL" -Default "")
  externalRuntimeDir = $paths.ExternalRuntimeDir
  includedEnv = (-not $WithoutEnv) -and (Test-Path $paths.EnvFile)
  items = $copiedItems
}

Write-JsonFile -Path (Join-Path $backupDir "manifest.json") -Data $manifest

Write-Step "Compactando backup"
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $backupDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "Backup concluido." -ForegroundColor Green
Write-Host "Pasta: $backupDir" -ForegroundColor Green
Write-Host "Zip:   $zipPath" -ForegroundColor Green
Write-Host ""
