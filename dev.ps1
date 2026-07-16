# dev.ps1 — Mode développement : backend uvicorn (reload) + frontend Vite (HMR).
# Ouvre deux fenêtres PowerShell. Le frontend proxifie /api et /ws vers le backend.
#
# Frontend dev : http://localhost:5173  ·  Backend : http://localhost:8765

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root

$venvPython = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host "Créez d'abord l'environnement (lancez start.ps1 une fois)." -ForegroundColor Red
    exit 1
}

Write-Host "=== PortaCheck — mode développement ===" -ForegroundColor Cyan

# Backend avec rechargement à chaud, dans une nouvelle fenêtre.
$backendCmd = "Set-Location '$root\backend'; & '$venvPython' -m uvicorn main:app --host 127.0.0.1 --port 8765 --reload"
Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCmd

# Frontend Vite (HMR) dans une nouvelle fenêtre.
$frontendCmd = "Set-Location '$root\frontend'; if (-not (Test-Path 'node_modules')) { npm install }; npm run dev"
Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontendCmd

Start-Sleep -Seconds 3
Start-Process 'http://localhost:5173'
Write-Host "Backend : http://localhost:8765  ·  Frontend (dev) : http://localhost:5173" -ForegroundColor Green
