# Запуск локальной админки Nexus (прокси к Render).
# Откройте: http://127.0.0.1:8790/local-admin/

$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root "nexus-cloud-server\scripts\start_local_admin.ps1"

if (-not (Test-Path $script)) {
    Write-Error "Не найден: $script"
    exit 1
}

& $script @args
