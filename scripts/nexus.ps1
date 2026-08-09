# Nexus local developer CLI (Windows)
# Usage: nexus.bat <install|start|stop|diagnose|status|admin>
# The .bat launcher already uses -ExecutionPolicy Bypass, so users do not need
# to change the machine/user PowerShell execution policy.

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command = '',

    [switch]$Cloud,
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$Script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Script:Lib = Join-Path $PSScriptRoot 'lib'
$Script:VenvPython = Join-Path $Script:Root 'venv\Scripts\python.exe'
$Script:ProductionCloudUrl = if ($env:NEXUS_PRODUCTION_CLOUD_URL) { $env:NEXUS_PRODUCTION_CLOUD_URL.TrimEnd('/') } else { 'https://nexus-cloud-ee17.onrender.com' }

function Repair-LegacyFrontendEnv {
    $envPath = Join-Path $Script:Root 'frontend\.env.local'
    if (-not (Test-Path $envPath)) { return }
    try {
        $content = Get-Content -Raw -Path $envPath
        $pattern = '(?m)^VITE_API_BASE=(http://127\.0\.0\.1:(?:8000|8001|8002)/api)\s*$'
        if ($content -match $pattern) {
            $updated = [regex]::Replace($content, $pattern, 'VITE_IDE_API_BASE=$1')
            Set-Content -Path $envPath -Value $updated.TrimEnd() -Encoding UTF8
            Add-Content -Path $envPath -Value '' -Encoding UTF8
            Write-Host '[Nexus] Migrated old local IDE VITE_API_BASE -> VITE_IDE_API_BASE.' -ForegroundColor DarkCyan
        }
    } catch {
        Write-Host '[Nexus] Could not inspect frontend\.env.local; continuing.' -ForegroundColor DarkYellow
    }
}

function Find-SystemPython {
    $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
    if ($pyLauncher) {
        try {
            $candidate = (& py -3 -c "import sys; print(sys.executable)" 2>$null | Select-Object -First 1).Trim()
            if ($candidate -and (Test-Path $candidate)) { return $candidate }
        } catch { }
    }

    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    Write-Host '[ERROR] Python 3 not found. Install Python 3.10+ and restart the terminal.' -ForegroundColor Red
    exit 1
}

function Ensure-NexusVenv {
    if (Test-Path $Script:VenvPython) { return $Script:VenvPython }

    $systemPy = Find-SystemPython
    Write-Host '[Nexus] Creating isolated Python environment: .\venv' -ForegroundColor DarkCyan
    & $systemPy -m venv (Join-Path $Script:Root 'venv')
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Script:VenvPython)) {
        throw 'Could not create Python virtual environment.'
    }
    return $Script:VenvPython
}

function Find-NexusPython {
    if (Test-Path $Script:VenvPython) { return $Script:VenvPython }
    return Find-SystemPython
}

function Invoke-FreePort {
    param([int]$Port)
    & (Join-Path $Script:Lib 'free-port.ps1') -Port $Port
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Invoke-FreePorts {
    param([int[]]$Ports = @(8080, 8000, 5173))
    foreach ($p in $Ports) { Invoke-FreePort -Port $p }
}

function Test-TcpPort {
    param([int]$Port, [int]$TimeoutMs = 500)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) { return $false }
        $client.EndConnect($async)
        return $client.Connected
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-TcpPort {
    param([int]$Port, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-TcpPort -Port $Port) { return $true }
        Start-Sleep -Milliseconds 350
    }
    return $false
}

function Wait-HttpUrl {
    param([string]$Url, [int]$TimeoutSeconds = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
        } catch { }
        Start-Sleep -Milliseconds 450
    }
    return $false
}

function Start-NexusWindow {
    param(
        [Parameter(Mandatory = $true)][string]$InternalCommand,
        [Parameter(Mandatory = $true)][string]$Title
    )
    $ps1 = Join-Path $Script:Root 'scripts\nexus.ps1'
    $cmdLine = "title $Title && powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File `"$ps1`" $InternalCommand"
    Start-Process -FilePath 'cmd.exe' -WorkingDirectory $Script:Root -ArgumentList @('/k', $cmdLine) | Out-Null
}

function Show-NexusHelp {
    Write-Host ''
    Write-Host 'Nexus local launcher' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  nexus.bat install      install isolated Python + frontend dependencies'
    Write-Host '  nexus.bat start        connected mode: PROD accounts/billing/AI + local IDE'
    Write-Host '  nexus.bat start-local  local isolated Cloud :8080 + Backend :8000 + Frontend :5173'
    Write-Host '  nexus.bat stop         stop Nexus processes by ports'
    Write-Host '  nexus.bat status       quick port / health status'
    Write-Host '  nexus.bat diagnose     extended diagnostics'
    Write-Host '  nexus.bat admin        local admin UI on :8790'
    Write-Host ''
    Write-Host 'Individual services:'
    Write-Host '  nexus.bat cloud'
    Write-Host '  nexus.bat cloud-check   check persistent production Cloud'
    Write-Host '  nexus.bat backend'
    Write-Host '  nexus.bat frontend'
    Write-Host ''
    Write-Host 'Open: http://localhost:5173'
    Write-Host ''
}

function Show-NexusMenu {
    while ($true) {
        Write-Host ''
        Write-Host 'Nexus launcher' -ForegroundColor Cyan
        Write-Host '  1  install'
        Write-Host '  2  start connected (recommended)'
        Write-Host '  L  start local isolated stack'
        Write-Host '  3  cloud'
        Write-Host '  4  backend'
        Write-Host '  5  frontend'
        Write-Host '  6  admin'
        Write-Host '  7  stop'
        Write-Host '  8  diagnose'
        Write-Host '  9  status'
        Write-Host '  Q  quit'
        Write-Host ''
        $choice = Read-Host 'Select [1-9 or Q]'
        switch -Regex ($choice) {
            '^1$' { Install-NexusDeps; continue }
            '^2$' { Start-NexusConnectedStack; continue }
            '^[Ll]$' { Start-NexusStack; continue }
            '^3$' { Start-NexusCloud -Foreground; continue }
            '^4$' { Start-NexusBackend -Foreground; continue }
            '^5$' { Start-NexusFrontend -Foreground; continue }
            '^6$' { Start-NexusAdmin; continue }
            '^7$' { Stop-Nexus; continue }
            '^8$' { Invoke-NexusDiagnose; continue }
            '^9$' { Show-NexusStatus; continue }
            '^[Qq]$' { return }
            '^$' { continue }
            default { Write-Host 'Invalid choice.' -ForegroundColor Yellow }
        }
    }
}

function Install-NexusDeps {
    $py = Ensure-NexusVenv
    Write-Host ''
    Write-Host '=== Nexus: install dependencies ===' -ForegroundColor Cyan
    Write-Host "Python env: $py" -ForegroundColor DarkGray

    Write-Host ''
    Write-Host '[1/3] nexus-cloud-server'
    & $py -m pip install -r (Join-Path $Script:Root 'nexus-cloud-server\requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'pip install failed (nexus-cloud-server)' }

    Write-Host ''
    Write-Host '[2/3] backend'
    & $py -m pip install -r (Join-Path $Script:Root 'backend\requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'pip install failed (backend)' }

    Write-Host ''
    Write-Host '[3/3] frontend'
    Push-Location (Join-Path $Script:Root 'frontend')
    try {
        if (Test-Path 'package-lock.json') {
            npm.cmd ci
        } else {
            npm.cmd install
        }
        if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
    } finally {
        Pop-Location
    }

    Write-Host ''
    Write-Host 'OK. Start with: nexus.bat start  (connected production account system)' -ForegroundColor Green
}

function Start-NexusCloud {
    param([switch]$Foreground, [switch]$SkipFreePort)
    $py = Find-NexusPython
    if (-not $SkipFreePort) { Invoke-FreePort -Port 8080 }
    if ($Foreground) {
        & $py (Join-Path $Script:Lib 'serve-cloud.py')
        $code = $LASTEXITCODE
        if ($code -ne 0) { Write-Host "Cloud exited with code $code" -ForegroundColor Red }
        exit $code
    }
}

function Start-NexusBackend {
    param([switch]$Foreground, [switch]$SkipFreePort)
    $py = Find-NexusPython
    if (-not $SkipFreePort) { Invoke-FreePort -Port 8000 }
    if ($Foreground) {
        & $py (Join-Path $Script:Lib 'serve-backend.py')
        $code = $LASTEXITCODE
        if ($code -ne 0) { Write-Host "Backend exited with code $code" -ForegroundColor Red }
        exit $code
    }
}

function Start-NexusFrontend {
    param([switch]$Foreground, [switch]$SkipFreePort, [switch]$Connected)
    if (-not $SkipFreePort) { Invoke-FreePort -Port 5173 }
    $fe = Join-Path $Script:Root 'frontend'
    if (-not (Test-Path (Join-Path $fe 'node_modules'))) {
        Write-Host '[Nexus] frontend/node_modules not found. Installing...'
        Push-Location $fe
        try {
            if (Test-Path 'package-lock.json') { npm.cmd ci } else { npm.cmd install }
            if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
        } finally { Pop-Location }
    }

    if ($Foreground) {
        if ($Connected) {
            $env:NEXUS_DEV_CLOUD_TARGET = $Script:ProductionCloudUrl
            Write-Host "Nexus Cloud proxy: $Script:ProductionCloudUrl" -ForegroundColor DarkCyan
        } else {
            Remove-Item Env:NEXUS_DEV_CLOUD_TARGET -ErrorAction SilentlyContinue
        }
        Push-Location $fe
        try {
            Write-Host 'Nexus Frontend: http://localhost:5173' -ForegroundColor Cyan
            npm.cmd run dev -- --host 127.0.0.1 --strictPort
            $code = $LASTEXITCODE
            if ($code -ne 0) { Write-Host "Frontend exited with code $code" -ForegroundColor Red }
            exit $code
        } finally { Pop-Location }
    }
}

function Test-NexusProductionCloud {
    param([switch]$Quiet)
    $health = "$Script:ProductionCloudUrl/v1/health"
    if (-not $Quiet) {
        Write-Host "[Nexus] Checking persistent Cloud: $health" -ForegroundColor DarkCyan
    }
    if (Wait-HttpUrl -Url $health -TimeoutSeconds 65) {
        if (-not $Quiet) { Write-Host '[Nexus] Production Cloud ready.' -ForegroundColor Green }
        return $true
    }
    if (-not $Quiet) {
        Write-Host '[ERROR] Production Cloud is unavailable.' -ForegroundColor Red
        Write-Host "URL: $health" -ForegroundColor Yellow
        Write-Host 'Accounts, subscriptions and AI models require this service.' -ForegroundColor Yellow
        Write-Host 'Override it with NEXUS_PRODUCTION_CLOUD_URL if your production URL changed.' -ForegroundColor Yellow
    }
    return $false
}

function Start-NexusConnectedStack {
    Write-Host ''
    Write-Host '[Nexus] CONNECTED mode' -ForegroundColor Cyan
    Write-Host '  Accounts / subscriptions / AI : persistent production Cloud' -ForegroundColor DarkGray
    Write-Host '  IDE filesystem / terminal     : local Backend :8000' -ForegroundColor DarkGray
    Write-Host '  UI                            : local Frontend :5173' -ForegroundColor DarkGray
    Write-Host ''

    if (-not (Test-NexusProductionCloud)) { return }

    Write-Host '[Nexus] Free ports 8000, 5173...' -ForegroundColor DarkCyan
    Invoke-FreePorts -Ports @(8000, 5173)
    Start-Sleep -Milliseconds 500

    Write-Host '[Nexus] Starting local IDE Backend :8000...'
    Start-NexusWindow -InternalCommand '_run-backend' -Title 'Nexus Backend 8000'
    if (-not (Wait-TcpPort -Port 8000 -TimeoutSeconds 25)) {
        Write-Host '[ERROR] Backend did not become ready on :8000.' -ForegroundColor Red
        return
    }

    Write-Host '[Nexus] Starting Frontend :5173 -> production Cloud...'
    Start-NexusWindow -InternalCommand '_run-frontend-connected' -Title 'Nexus Frontend 5173 CONNECTED'
    if (-not (Wait-TcpPort -Port 5173 -TimeoutSeconds 30)) {
        Write-Host '[ERROR] Frontend did not become ready on :5173.' -ForegroundColor Red
        return
    }

    Write-Host ''
    Write-Host 'Nexus CONNECTED is ready: http://localhost:5173' -ForegroundColor Green
    Write-Host "Account/AI Cloud: $Script:ProductionCloudUrl" -ForegroundColor DarkGray
    Write-Host 'IDE Backend:      http://127.0.0.1:8000' -ForegroundColor DarkGray
    Write-Host 'Local Cloud :8080 is intentionally NOT used in this mode.' -ForegroundColor DarkGray
    Write-Host ''
    try { Start-Process 'http://localhost:5173' | Out-Null } catch { }
}

function Start-NexusStack {
    param(
        [switch]$CloudOnly,
        [switch]$BackendOnly,
        [switch]$FrontendOnly
    )

    $startCloud = $CloudOnly -or (-not $CloudOnly -and -not $BackendOnly -and -not $FrontendOnly)
    $startBackend = $BackendOnly -or (-not $CloudOnly -and -not $BackendOnly -and -not $FrontendOnly)
    $startFrontend = $FrontendOnly -or (-not $CloudOnly -and -not $BackendOnly -and -not $FrontendOnly)

    $ports = @()
    if ($startCloud) { $ports += 8080 }
    if ($startBackend) { $ports += 8000 }
    if ($startFrontend) { $ports += 5173 }

    if ($ports.Count -gt 0) {
        Write-Host ''
        Write-Host "[Nexus] Free ports $($ports -join ', ')..." -ForegroundColor DarkCyan
        Invoke-FreePorts -Ports $ports
        Start-Sleep -Milliseconds 500
    }

    if ($startCloud) {
        Write-Host '[Nexus] Starting Cloud :8080...'
        Start-NexusWindow -InternalCommand '_run-cloud' -Title 'Nexus Cloud 8080'
        if (-not (Wait-HttpUrl -Url 'http://127.0.0.1:8080/v1/health' -TimeoutSeconds 35)) {
            Write-Host '[ERROR] Cloud did not become ready on :8080.' -ForegroundColor Red
            Write-Host 'Keep the "Nexus Cloud 8080" window open and copy its error output.' -ForegroundColor Yellow
            return
        }
        Write-Host '[Nexus] Cloud ready.' -ForegroundColor Green
    }

    if ($startBackend) {
        Write-Host '[Nexus] Starting local IDE Backend :8000...'
        Start-NexusWindow -InternalCommand '_run-backend' -Title 'Nexus Backend 8000'
        if (-not (Wait-TcpPort -Port 8000 -TimeoutSeconds 25)) {
            Write-Host '[ERROR] Backend did not become ready on :8000.' -ForegroundColor Red
            Write-Host 'Keep the "Nexus Backend 8000" window open and copy its error output.' -ForegroundColor Yellow
            return
        }
        Write-Host '[Nexus] Backend ready.' -ForegroundColor Green
    }

    if ($startFrontend) {
        if ($startCloud -and -not (Test-TcpPort -Port 8080)) {
            Write-Host '[ERROR] Cloud is not running; frontend was not started to avoid broken API proxy requests.' -ForegroundColor Red
            return
        }
        Write-Host '[Nexus] Starting Frontend :5173...'
        Start-NexusWindow -InternalCommand '_run-frontend' -Title 'Nexus Frontend 5173'
        if (-not (Wait-TcpPort -Port 5173 -TimeoutSeconds 30)) {
            Write-Host '[ERROR] Frontend did not become ready on :5173.' -ForegroundColor Red
            Write-Host 'Keep the "Nexus Frontend 5173" window open and copy its error output.' -ForegroundColor Yellow
            return
        }
        Write-Host '[Nexus] Frontend ready.' -ForegroundColor Green
    }

    Write-Host ''
    Write-Host 'Nexus is ready: http://localhost:5173' -ForegroundColor Green
    Write-Host 'Cloud API:      http://127.0.0.1:8080/v1/health' -ForegroundColor DarkGray
    Write-Host 'IDE Backend:    http://127.0.0.1:8000' -ForegroundColor DarkGray
    Write-Host ''

    if ($startFrontend -and -not $FrontendOnly) {
        try { Start-Process 'http://localhost:5173' | Out-Null } catch { }
    }
}

function Stop-Nexus {
    Write-Host 'Stopping Nexus (ports 5173, 8000, 8080)...' -ForegroundColor DarkCyan
    Invoke-FreePorts
    Start-Sleep -Milliseconds 500
    Write-Host 'Done.' -ForegroundColor Green
}

function Show-NexusStatus {
    Write-Host ''
    Write-Host 'Nexus status' -ForegroundColor Cyan
    if (Test-NexusProductionCloud -Quiet) {
        Write-Host ("  {0,-10} {1}  ONLINE" -f 'ProdCloud', $Script:ProductionCloudUrl) -ForegroundColor Green
    } else {
        Write-Host ("  {0,-10} {1}  offline" -f 'ProdCloud', $Script:ProductionCloudUrl) -ForegroundColor DarkGray
    }
    foreach ($entry in @(@(8080, 'Cloud'), @(8000, 'Backend'), @(5173, 'Frontend'))) {
        $port = [int]$entry[0]
        $name = [string]$entry[1]
        if (Test-TcpPort -Port $port) {
            Write-Host ("  {0,-10} :{1}  ONLINE" -f $name, $port) -ForegroundColor Green
        } else {
            Write-Host ("  {0,-10} :{1}  offline" -f $name, $port) -ForegroundColor DarkGray
        }
    }
    Write-Host ''
}

function Invoke-NexusDiagnose {
    & (Join-Path $Script:Lib 'diagnose.ps1')
}

function Start-NexusAdmin {
    $script = Join-Path $Script:Root 'nexus-cloud-server\scripts\start_local_admin.ps1'
    if (-not (Test-Path $script)) {
        Write-Error "Not found: $script"
        exit 1
    }
    & $script @args
    exit $LASTEXITCODE
}

function Invoke-PauseIfNeeded {
    if (-not $NoPause -and $Host.Name -eq 'ConsoleHost') {
        try {
            $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$PID").ParentProcessId
            $pname = (Get-CimInstance Win32_Process -Filter "ProcessId=$parent" -ErrorAction SilentlyContinue).Name
            if ($pname -match 'cmd\.exe') { pause }
        } catch { }
    }
}

# --- main ---
Set-Location $Script:Root
Repair-LegacyFrontendEnv
$cmd = $Command.Trim().ToLowerInvariant()

if (-not $cmd) {
    Show-NexusMenu
    exit 0
}

try {
    switch ($cmd) {
        { $_ -in 'help', '-?', '--help' } { Show-NexusHelp }
        { $_ -in 'install', 'install-deps' } { Install-NexusDeps }
        { $_ -in 'start', 'start-connected' } { Start-NexusConnectedStack }
        { $_ -in 'start-local', 'start-all', 'local' } { Start-NexusStack -CloudOnly:$Cloud -BackendOnly:$Backend -FrontendOnly:$Frontend }
        { $_ -in 'cloud', 'start-cloud' } { Start-NexusCloud -Foreground }
        { $_ -in 'backend', 'start-backend' } { Start-NexusBackend -Foreground }
        { $_ -in 'frontend', 'start-frontend' } { Start-NexusFrontend -Foreground }
        { $_ -in 'frontend-connected', 'start-frontend-connected' } { Start-NexusFrontend -Foreground -Connected }
        'cloud-check' { if (-not (Test-NexusProductionCloud)) { exit 1 } }
        'admin' { Start-NexusAdmin }
        { $_ -in 'stop', 'stop-all' } { Stop-Nexus }
        'status' { Show-NexusStatus }
        'diagnose' { Invoke-NexusDiagnose }
        '_run-cloud' { Start-NexusCloud -Foreground -SkipFreePort }
        '_run-backend' { Start-NexusBackend -Foreground -SkipFreePort }
        '_run-frontend' { Start-NexusFrontend -Foreground -SkipFreePort }
        '_run-frontend-connected' { Start-NexusFrontend -Foreground -SkipFreePort -Connected }
        default {
            Write-Host "Unknown command: $Command" -ForegroundColor Red
            Show-NexusHelp
            exit 1
        }
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Invoke-PauseIfNeeded
