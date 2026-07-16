# -*- mode: python ; coding: utf-8 -*-
# Spec PyInstaller pour PortaCheck — exe autonome (onefile).
# Embarque : le backend, le build du frontend (frontend/dist), platform-tools (adb),
# et toutes les dépendances Python. Aucune installation requise côté technicien.

import os
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

ROOT = os.path.abspath(os.getcwd())

# Ressources à embarquer : (source_sur_disque, dossier_cible_dans_le_bundle)
datas = [
    (os.path.join(ROOT, 'frontend', 'dist'), os.path.join('frontend', 'dist')),
    (os.path.join(ROOT, 'backend'), 'backend'),
]

# platform-tools (adb.exe + DLL) : embarqué s'il est présent à la racine du projet
# (copié par build-exe.ps1) ou dans C:\platform-tools.
_pt_local = os.path.join(ROOT, 'platform-tools')
_pt_system = r'C:\platform-tools'
_pt = _pt_local if os.path.isdir(_pt_local) else (_pt_system if os.path.isdir(_pt_system) else None)
if _pt:
    datas.append((_pt, 'platform-tools'))

# openpyxl embarque des données (.constants.json, etc.).
datas += collect_data_files('openpyxl')

# Imports que PyInstaller ne détecte pas toujours (uvicorn charge dynamiquement).
hiddenimports = []
hiddenimports += collect_submodules('uvicorn')
hiddenimports += [
    'anyio', 'anyio._backends._asyncio',
    'websockets', 'websockets.legacy', 'websockets.legacy.server',
    'uvicorn.protocols.websockets.websockets_impl',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.lifespan.on',
    'fastapi', 'openpyxl',
    # modules du backend importés dynamiquement
    'main', 'config_loader', 'adb_service', 'adb_parsers', 'database',
    'phone_numbers', 'phone_state', 'report', 'tabular_import',
]

block_cipher = None

a = Analysis(
    ['run_app.py'],
    pathex=[ROOT, os.path.join(ROOT, 'backend')],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'pytest', 'PyInstaller'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PortaCheck',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,          # garde une fenêtre console (utile : messages + Ctrl+C)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(ROOT, 'icon.ico') if os.path.exists(os.path.join(ROOT, 'icon.ico')) else None,
)
