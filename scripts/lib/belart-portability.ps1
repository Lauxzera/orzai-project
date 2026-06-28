Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Info {
  param([string]$Message)
  Write-Host "    $Message" -ForegroundColor Gray
}

function Write-Warn {
  param([string]$Message)
  Write-Host "    $Message" -ForegroundColor Yellow
}

function Read-EnvValue {
  param(
    [string]$FilePath,
    [string]$Name,
    [string]$Default = ""
  )

  if (-not (Test-Path $FilePath)) {
    return $Default
  }

  $line = Get-Content $FilePath | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -First 1
  if (-not $line) {
    return $Default
  }

  return ($line -replace "^$([regex]::Escape($Name))=", "").Trim()
}

function Resolve-AbsolutePath {
  param(
    [string]$BasePath,
    [string]$Path
  )

  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $null
  }

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

function Get-BelartProjectPaths {
  param([string]$ProjectRoot)

  $envFile = Join-Path $ProjectRoot ".env.local"
  $runtimeOverride = Read-EnvValue -FilePath $envFile -Name "BELART_RUNTIME_DIR" -Default ""
  $runtimeDir = if ($runtimeOverride) {
    Resolve-AbsolutePath -BasePath $ProjectRoot -Path $runtimeOverride
  } elseif ($env:LOCALAPPDATA) {
    Join-Path $env:LOCALAPPDATA "BelartCRM\runtime"
  } else {
    Join-Path $ProjectRoot ".runtime\external"
  }

  return [pscustomobject]@{
    ProjectRoot = $ProjectRoot
    EnvFile = $envFile
    DataDir = Join-Path $ProjectRoot "data"
    RuntimeDir = Join-Path $ProjectRoot ".runtime"
    BackupsDir = Join-Path $ProjectRoot ".runtime\backups"
    PortableDir = Join-Path $ProjectRoot ".runtime\portable"
    ExternalRuntimeDir = $runtimeDir
    CrmPidFile = Join-Path $ProjectRoot ".runtime\crm.pid"
  }
}

function Ensure-Directory {
  param([string]$Path)
  New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

function Copy-PathIfExists {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path $Source)) {
    return $false
  }

  Ensure-Directory -Path (Split-Path -Parent $Destination)
  Copy-Item -Path $Source -Destination $Destination -Recurse -Force
  return $true
}

function Reset-DirectoryFromSource {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path $Source)) {
    return $false
  }

  Ensure-Directory -Path $Destination
  Get-ChildItem -Path $Destination -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item -Path (Join-Path $Source "*") -Destination $Destination -Recurse -Force
  return $true
}

function New-Timestamp {
  return Get-Date -Format "yyyyMMdd-HHmmss"
}

function Stop-ManagedProcess {
  param([string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return
  }

  try {
    $pidValue = Get-Content $PidFile -ErrorAction Stop | Select-Object -First 1
    if ($pidValue -match "^\d+$") {
      $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
      if ($process) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        Write-Info "Processo anterior encerrado (PID $pidValue)."
      }
    }
  } finally {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
  }
}

function Stop-ProjectServerOnPort {
  param(
    [int]$Port,
    [string]$ProjectRoot
  )

  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if (-not $process) {
      continue
    }

    $commandLine = [string]$process.CommandLine
    $matchesProject = $commandLine -like "*$ProjectRoot*"
    $looksLikeNext = $commandLine -like "*next*dev*"

    if ($matchesProject -or $looksLikeNext) {
      Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
      Write-Info "Servidor anterior do projeto encerrado na porta $Port (PID $($listener.OwningProcess))."
    }
  }
}

function Get-LatestBackupSource {
  param([string]$BackupsDir)

  if (-not (Test-Path $BackupsDir)) {
    return $null
  }

  $latest = Get-ChildItem -Path $BackupsDir -Force |
    Where-Object { $_.Name -like "belart-crm-backup-*" -and ($_.PSIsContainer -or $_.Extension -eq ".zip") } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  return $latest?.FullName
}

function Write-JsonFile {
  param(
    [string]$Path,
    [object]$Data
  )

  Ensure-Directory -Path (Split-Path -Parent $Path)
  $Data | ConvertTo-Json -Depth 8 | Set-Content -Path $Path -Encoding UTF8
}
