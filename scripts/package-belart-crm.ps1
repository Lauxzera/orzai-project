param(
  [switch]$WithoutEnv,
  [switch]$WithoutRuntimeData
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "lib\belart-portability.ps1")

$projectRoot = Split-Path -Parent $PSScriptRoot
$paths = Get-BelartProjectPaths -ProjectRoot $projectRoot
$timestamp = New-Timestamp
$packageName = "belart-crm-portavel-$timestamp"
$stagingDir = Join-Path $paths.PortableDir $packageName
$zipPath = "$stagingDir.zip"

Write-Host ""
Write-Host "Belart CRM - Pacote portavel" -ForegroundColor Green
Write-Host ""

Write-Step "Preparando pasta temporaria"
Ensure-Directory -Path $paths.PortableDir
if (Test-Path $stagingDir) {
  Remove-Item $stagingDir -Recurse -Force
}
Ensure-Directory -Path $stagingDir

$excludeDirs = @(".git", ".next", "node_modules", ".runtime")
$allFiles = Get-ChildItem -Path $projectRoot -Recurse -Force -File | Where-Object {
  $fullName = $_.FullName
  foreach ($dirName in $excludeDirs) {
    if ($fullName -like "*\$dirName\*") {
      return $false
    }
  }

  if ($WithoutEnv -and $_.Name -eq ".env.local") {
    return $false
  }

  return $true
}

Write-Step "Copiando codigo e configuracao do projeto"
foreach ($file in $allFiles) {
  $relativePath = $file.FullName.Substring($projectRoot.Length).TrimStart("\")
  $destination = Join-Path $stagingDir $relativePath
  Ensure-Directory -Path (Split-Path -Parent $destination)
  Copy-Item -Path $file.FullName -Destination $destination -Force
}

$manifest = [ordered]@{
  project = "Belart CRM"
  createdAt = (Get-Date).ToString("o")
  machine = $env:COMPUTERNAME
  includesEnv = (-not $WithoutEnv) -and (Test-Path $paths.EnvFile)
  includesRuntimeData = $false
}
Write-JsonFile -Path (Join-Path $stagingDir "_transfer\portable-manifest.json") -Data $manifest

Write-Step "Compactando pacote"
if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}
Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host ""
Write-Host "Pacote portavel concluido." -ForegroundColor Green
Write-Host "Pasta: $stagingDir" -ForegroundColor Green
Write-Host "Zip:   $zipPath" -ForegroundColor Green
Write-Host ""
