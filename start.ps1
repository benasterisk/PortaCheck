# start.ps1 — Lance PortaCheck (production) : vérifie l'environnement, build le
# frontend si besoin, démarre uvicorn et ouvre le navigateur.
#
# Lancement recommandé : double-clic sur "Lancer-PortaCheck.bat".
# (Le clic droit > "Exécuter avec PowerShell" peut échouer silencieusement selon
#  l'ExecutionPolicy — le .bat contourne ce problème.)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root

try {
    Write-Host "=== PortaCheck — démarrage ===" -ForegroundColor Cyan

    # --- 1. Vérifier Python / venv ---
    $venvPython = Join-Path $root '.venv\Scripts\python.exe'
    if (-not (Test-Path $venvPython)) {
        Write-Host "Environnement Python absent. Création du venv et installation des dépendances…" -ForegroundColor Yellow
        python -m venv .venv
        & $venvPython -m pip install --upgrade pip
        & $venvPython -m pip install -r requirements.txt
    }

    # --- 2. Vérifier ADB ---
    $config = Get-Content (Join-Path $root 'config.json') -Raw | ConvertFrom-Json
    $adbPath = $config.adb_path
    if (-not (Test-Path $adbPath)) {
        Write-Host "⚠ ADB introuvable à '$adbPath'." -ForegroundColor Red
        Write-Host "  Installez les platform-tools (https://developer.android.com/tools/releases/platform-tools)" -ForegroundColor Red
        Write-Host "  ou corrigez 'adb_path' dans config.json, puis relancez." -ForegroundColor Red
        Write-Host "  (L'application démarrera quand même et signalera l'absence d'ADB.)" -ForegroundColor Yellow
    }

    # --- 3. Build frontend si nécessaire ---
    $dist = Join-Path $root 'frontend\dist\index.html'
    if (-not (Test-Path $dist)) {
        Write-Host "Build du frontend (première fois)…" -ForegroundColor Yellow
        Push-Location (Join-Path $root 'frontend')
        if (-not (Test-Path 'node_modules')) { npm install }
        npm run build
        Pop-Location
    }

    # --- 4. Vérifier que le port est libre ---
    $port = [int]$config.port
    $busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($busy) {
        Write-Host "Le port $port est déjà utilisé (une instance tourne peut-être déjà)." -ForegroundColor Yellow
        Write-Host "Ouverture de http://localhost:$port dans le navigateur." -ForegroundColor Green
        Start-Process "http://localhost:$port"
        Write-Host "Si ce n'est pas la bonne instance, fermez l'autre fenêtre PortaCheck et relancez." -ForegroundColor Yellow
        Read-Host "Entrée pour quitter"
        return
    }

    # --- 5. Démarrer le serveur ---
    Write-Host "Démarrage du serveur sur http://localhost:$port …" -ForegroundColor Green
    Write-Host "(Laissez cette fenêtre ouverte. Fermez-la ou Ctrl+C pour arrêter l'application.)" -ForegroundColor DarkGray

    # Ouvrir le navigateur après un court délai, sans bloquer (WScript.Shell = fiable).
    if ($config.open_browser_on_start) {
        $opener = {
            param($url)
            Start-Sleep -Seconds 3
            Start-Process $url
        }
        Start-Job -ScriptBlock $opener -ArgumentList "http://localhost:$port" | Out-Null
    }

    Set-Location (Join-Path $root 'backend')
    & $venvPython -m uvicorn main:app --host 127.0.0.1 --port $port
}
catch {
    Write-Host ""
    Write-Host "=== ERREUR au démarrage de PortaCheck ===" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    Read-Host "Appuyez sur Entrée pour fermer"
}
