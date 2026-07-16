# build-exe.ps1 — Construit PortaCheck.exe autonome (Python + deps + frontend + adb).
# Prérequis développeur : Python, Node, et l'environnement .venv déjà créé.
# Le technicien final n'a besoin QUE du .exe produit (dist\PortaCheck.exe).

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Set-Location $root
$py = Join-Path $root '.venv\Scripts\python.exe'

Write-Host "=== Build PortaCheck.exe ===" -ForegroundColor Cyan

# 1. Dépendances de build (pyinstaller).
& $py -m pip install pyinstaller --quiet

# 2. Build du frontend (prod).
Write-Host "Build du frontend…" -ForegroundColor Yellow
Push-Location (Join-Path $root 'frontend')
if (-not (Test-Path 'node_modules')) { npm install }
npm run build
Pop-Location

# 3. Récupérer platform-tools (adb + DLL) pour l'embarquer.
$ptLocal = Join-Path $root 'platform-tools'
if (-not (Test-Path (Join-Path $ptLocal 'adb.exe'))) {
    $ptSystem = 'C:\platform-tools'
    if (Test-Path (Join-Path $ptSystem 'adb.exe')) {
        Write-Host "Copie de platform-tools depuis $ptSystem…" -ForegroundColor Yellow
        New-Item -ItemType Directory -Force $ptLocal | Out-Null
        Copy-Item (Join-Path $ptSystem 'adb.exe') $ptLocal -Force
        foreach ($dll in @('AdbWinApi.dll', 'AdbWinUsbApi.dll')) {
            $src = Join-Path $ptSystem $dll
            if (Test-Path $src) { Copy-Item $src $ptLocal -Force }
        }
    } else {
        Write-Host "⚠ platform-tools introuvable (ni ./platform-tools ni C:\platform-tools)." -ForegroundColor Red
        Write-Host "  L'exe sera construit SANS adb embarqué ; il faudra qu'adb soit installé sur la machine cible." -ForegroundColor Red
    }
}

# 4. Nettoyer les builds précédents.
Remove-Item (Join-Path $root 'build') -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $root 'dist\PortaCheck.exe') -Force -ErrorAction SilentlyContinue

# 5. PyInstaller.
Write-Host "Empaquetage avec PyInstaller (peut prendre 1-2 min)…" -ForegroundColor Yellow
& $py -m PyInstaller PortaCheck.spec --noconfirm

$exe = Join-Path $root 'dist\PortaCheck.exe'
if (Test-Path $exe) {
    $size = [math]::Round((Get-Item $exe).Length / 1MB, 1)
    Write-Host ""
    Write-Host "=== OK : dist\PortaCheck.exe ($size Mo) ===" -ForegroundColor Green
    Write-Host "  Donnez CE fichier au technicien : double-clic, aucune installation." -ForegroundColor Green
} else {
    Write-Host "=== ÉCHEC : l'exe n'a pas été produit. Voir les messages ci-dessus. ===" -ForegroundColor Red
}
