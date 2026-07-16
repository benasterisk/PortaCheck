@echo off
REM Lanceur PortaCheck — double-cliquez sur ce fichier.
REM Contourne l'ExecutionPolicy PowerShell et garde la fenetre ouverte.
title PortaCheck
cd /d "%~dp0"
echo ============================================
echo   PortaCheck - demarrage...
echo ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
echo ============================================
echo   Le serveur s'est arrete.
echo ============================================
pause
