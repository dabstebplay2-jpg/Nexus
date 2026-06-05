# Один раз: войти в GitHub, создать репозиторий и отправить код
# Запуск из PowerShell:  cd c:\nexus-ide\nexus-cloud-server
#                        .\scripts\publish-to-github.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "Установите GitHub CLI: winget install GitHub.cli"
    exit 1
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Войдите в GitHub (откроется браузер):"
    gh auth login -h github.com -p https -w
}

$remote = "https://github.com/dabstebplay2-jpg/nexus-cloud-server.git"
git remote set-url origin $remote

$exists = gh repo view dabstebplay2-jpg/nexus-cloud-server 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Создаём репозиторий nexus-cloud-server..."
    gh repo create dabstebplay2-jpg/nexus-cloud-server --public --description "Nexus Cloud API: auth, billing, RouterAI"
}

Write-Host "Отправка main..."
git push -u origin main

Write-Host ""
Write-Host "Готово: https://github.com/dabstebplay2-jpg/nexus-cloud-server"
Write-Host "Render: New Web Service -> этот репозиторий, Start: uvicorn app.main:app --host 0.0.0.0 --port `$PORT"
