param(
  [ValidateSet("local", "network")]
  [string]$Mode = "local",

  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Info {
  param([string]$Message)
  Write-Host "    $Message" -ForegroundColor Gray
}

function Test-HttpEndpoint {
  param([string]$Url)
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Get-CommandPathOrThrow {
  param([string]$Name, [string]$InstallHint)
  $command = Get-Command $Name -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $command) {
    throw "$Name nao encontrado. $InstallHint"
  }
  return $command.Source
}

function Copy-DirectoryIfMissing {
  param(
    [string]$Source,
    [string]$Destination
  )

  if (-not (Test-Path $Source)) {
    return $false
  }

  if (Test-Path $Destination) {
    $hasContent = Get-ChildItem -Path $Destination -Force -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($hasContent) {
      return $false
    }
  }

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  Copy-Item -Path (Join-Path $Source "*") -Destination $Destination -Recurse -Force
  return $true
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

function Import-EnvFileIntoProcess {
  param([string]$FilePath)

  if (-not (Test-Path $FilePath)) {
    return
  }

  foreach ($line in Get-Content $FilePath) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }

    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) {
      continue
    }

    $name = $parts[0].Trim()
    if (-not $name) {
      continue
    }

    $value = $parts[1].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

function Get-LocalIPv4 {
  $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254*" -and
      $_.IPAddress -notlike "0.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object InterfaceMetric, SkipAsSource

  $preferred = $candidates | Select-Object -First 1
  if ($preferred) {
    return $preferred.IPAddress
  }

  return "127.0.0.1"
}

function Stop-ManagedProcess {
  param([string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return
  }

  try {
    $pidValue = Get-Content $PidFile -ErrorAction Stop | Select-Object -First 1
    if ($pidValue -match '^\d+$') {
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

function Start-HiddenProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory,
    [string]$RedirectStandardOutput = "",
    [string]$RedirectStandardError = ""
  )

  $startParams = @{
    FilePath = $FilePath
    ArgumentList = $ArgumentList
    WorkingDirectory = $WorkingDirectory
    WindowStyle = "Hidden"
    PassThru = $true
  }

  if ($RedirectStandardOutput) {
    $startParams.RedirectStandardOutput = $RedirectStandardOutput
  }

  if ($RedirectStandardError) {
    $startParams.RedirectStandardError = $RedirectStandardError
  }

  return Start-Process @startParams
}

function Start-HiddenPowerShellCommand {
  param(
    [string]$Command,
    [string]$WorkingDirectory
  )

  return Start-HiddenProcess -FilePath "powershell.exe" -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $Command
  ) -WorkingDirectory $WorkingDirectory
}

function Get-ExistingProcessByCommandPattern {
  param([string]$Pattern)

  return Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { [string]$_.CommandLine -like $Pattern } |
    Select-Object -First 1
}

function Wait-ForEndpoint {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpEndpoint $Url) {
      return $true
    }
    Start-Sleep -Milliseconds 750
  }
  return $false
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $ProjectRoot ".runtime"
$LogsDir = Join-Path $RuntimeDir "logs"
$EnvFile = Join-Path $ProjectRoot ".env.local"
$CrmPidFile = Join-Path $RuntimeDir "crm.pid"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$NodePath = Get-CommandPathOrThrow -Name "node" -InstallHint "Instale o Node.js em https://nodejs.org"
$NpmPath = Get-CommandPathOrThrow -Name "npm" -InstallHint "Instale o Node.js em https://nodejs.org"
$NextCliPath = Join-Path $ProjectRoot "node_modules\.bin\next.cmd"
$NextBinPath = Join-Path $ProjectRoot "node_modules\next\dist\bin\next"
$OpenRouterModel = Read-EnvValue -FilePath $EnvFile -Name "OPENROUTER_MODEL" -Default "openai/gpt-4o-mini"
$OpenRouterAssistantModel = Read-EnvValue -FilePath $EnvFile -Name "OPENROUTER_MODEL_ASSISTANT" -Default $OpenRouterModel
$OpenRouterLeadAnalysisModel = Read-EnvValue -FilePath $EnvFile -Name "OPENROUTER_MODEL_LEAD_ANALYSIS" -Default $OpenRouterModel
$OpenRouterConversationAnalysisModel = Read-EnvValue -FilePath $EnvFile -Name "OPENROUTER_MODEL_CONVERSATION_ANALYSIS" -Default $OpenRouterModel
$OpenRouterApiKey = Read-EnvValue -FilePath $EnvFile -Name "OPENROUTER_API_KEY" -Default ""
$BelartRuntimeDir = Read-EnvValue -FilePath $EnvFile -Name "BELART_RUNTIME_DIR" -Default ""
$ExternalRuntimeDir = if ($BelartRuntimeDir) {
  if ([System.IO.Path]::IsPathRooted($BelartRuntimeDir)) {
    [System.IO.Path]::GetFullPath($BelartRuntimeDir)
  } else {
    [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $BelartRuntimeDir))
  }
} elseif ($env:LOCALAPPDATA) {
  Join-Path $env:LOCALAPPDATA "BelartCRM\runtime"
} else {
  Join-Path $RuntimeDir "external"
}
$HostAddress = if ($Mode -eq "network") { "0.0.0.0" } else { "127.0.0.1" }
$OpenHost = if ($Mode -eq "network") { Get-LocalIPv4 } else { "127.0.0.1" }
$OpenUrl = "http://$OpenHost`:3000"

Write-Host ""
Write-Host "Belart CRM - Inicializacao completa" -ForegroundColor Green
Write-Host "Modo selecionado: $Mode" -ForegroundColor Green
Write-Host ""

Write-Step "Validando dependencias"
Write-Info "Node: $NodePath"
Write-Info "NPM:  $NpmPath"

if (-not $OpenRouterApiKey) {
  throw "OPENROUTER_API_KEY nao configurada no .env.local."
}

if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
  Write-Step "Instalando dependencias do projeto"
  & $NpmPath install
}

if (-not (Test-Path $NextCliPath)) {
  throw "Nao foi encontrado o executavel local do Next.js em $NextCliPath. Rode 'npm install' no projeto."
}

if (-not (Test-Path $NextBinPath)) {
  throw "Nao foi encontrado o binario do Next.js em $NextBinPath. Rode 'npm install' no projeto."
}

Write-Step "Reiniciando o CRM no modo selecionado"
Stop-ManagedProcess -PidFile $CrmPidFile
Stop-ProjectServerOnPort -Port 3000 -ProjectRoot $ProjectRoot

$crmOut = Join-Path $LogsDir "crm-$Mode.out.log"
$crmErr = Join-Path $LogsDir "crm-$Mode.err.log"

if ($Mode -eq "network") {
  Write-Step "Gerando build estavel do CRM"
  $buildOut = Join-Path $LogsDir "crm-build.out.log"
  $buildErr = Join-Path $LogsDir "crm-build.err.log"
  & $NpmPath run build 1>> $buildOut 2>> $buildErr
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao gerar o build do CRM. Veja os logs em $LogsDir."
  }
  $crmProcess = Start-HiddenProcess `
    -FilePath $NodePath `
    -ArgumentList @($NextBinPath, "start", "--hostname", $HostAddress, "--port", "3000") `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $crmOut `
    -RedirectStandardError $crmErr
} else {
  $crmProcess = Start-HiddenProcess `
    -FilePath $NodePath `
    -ArgumentList @($NextBinPath, "dev", "--webpack", "-H", $HostAddress, "-p", "3000") `
    -WorkingDirectory $ProjectRoot `
    -RedirectStandardOutput $crmOut `
    -RedirectStandardError $crmErr
}

Set-Content -Path $CrmPidFile -Value $crmProcess.Id
Write-Info "Processo do CRM iniciado com PID $($crmProcess.Id)."

Write-Step "Aguardando o CRM responder"
if (-not (Wait-ForEndpoint -Url $OpenUrl -TimeoutSeconds 75)) {
  throw "O CRM nao respondeu em $OpenUrl. Veja os logs em $LogsDir."
}

Write-Host ""
Write-Host "Projeto pronto." -ForegroundColor Green
Write-Host "URL: $OpenUrl" -ForegroundColor Green
Write-Host "Assistente: $OpenRouterAssistantModel" -ForegroundColor Green
Write-Host "Analise de lead: $OpenRouterLeadAnalysisModel" -ForegroundColor Green
Write-Host "Analise de conversa: $OpenRouterConversationAnalysisModel" -ForegroundColor Green
Write-Host ""

if (-not $NoBrowser) {
  Write-Step "Abrindo navegador"
  Start-Process $OpenUrl | Out-Null
}
