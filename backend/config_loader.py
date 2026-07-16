"""Chargement de la configuration (config.json) et du profil appareil (device_profile.json).

Le profil est produit par la Phase 0. La config ne contient que des chemins/ports
(jamais de secret). Les deux sont lus au démarrage et exposés via des accès simples.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any


def _is_frozen() -> bool:
    """True si on tourne dans un exe PyInstaller."""
    return getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")


def _bundle_root() -> Path:
    """Racine des RESSOURCES EMBARQUÉES (frontend/dist, platform-tools).

    - En exe PyInstaller : sys._MEIPASS (dossier temporaire d'extraction).
    - En dev : racine du projet (parent de backend/).
    """
    if _is_frozen():
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent.parent


def _data_root() -> Path:
    """Racine des DONNÉES PERSISTANTES (DB, logs, config, profil).

    - En exe : à côté de l'exécutable (persiste entre les lancements).
    - En dev : racine du projet.
    """
    if _is_frozen():
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


# Ressources embarquées (lecture seule dans l'exe).
BUNDLE_ROOT = _bundle_root()
# Données persistantes (lecture/écriture, à côté de l'exe).
DATA_ROOT = _data_root()

# ROOT conservé pour compatibilité (pointe vers les données).
ROOT = DATA_ROOT

CONFIG_PATH = DATA_ROOT / "config.json"
PROFILE_PATH = DATA_ROOT / "device_profile.json"
LOG_DIR = DATA_ROOT / "logs"
DB_PATH = DATA_ROOT / "portacheck.db"

# Frontend build : embarqué (BUNDLE_ROOT) en exe, sinon dans le projet.
FRONTEND_DIST = BUNDLE_ROOT / "frontend" / "dist"

# ADB embarqué : platform-tools inclus dans le package.
BUNDLED_ADB = BUNDLE_ROOT / "platform-tools" / "adb.exe"

_DEFAULT_CONFIG: dict[str, Any] = {
    "adb_path": r"C:\platform-tools\adb.exe",
    "port": 8765,
    "poll_interval_idle_s": 3,
    "poll_interval_call_s": 1,
    "dial_delay_default_s": 2,
    "dial_delay_min_s": 1,
    "open_browser_on_start": True,
}


def load_config() -> dict[str, Any]:
    """Charge config.json, complété par les valeurs par défaut."""
    cfg = dict(_DEFAULT_CONFIG)
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg.update(json.load(f))
        except (json.JSONDecodeError, OSError):
            # config illisible : on garde les valeurs par défaut, l'UI signalera l'ADB manquant
            pass
    return cfg


def load_profile() -> dict[str, Any] | None:
    """Charge device_profile.json produit par la Phase 0. None si absent."""
    if not PROFILE_PATH.exists():
        return None
    try:
        with open(PROFILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def save_profile(profile: dict[str, Any]) -> None:
    """Réécrit device_profile.json (utilisé après ré-inventaire ou repli manual)."""
    with open(PROFILE_PATH, "w", encoding="utf-8") as f:
        json.dump(profile, f, ensure_ascii=False, indent=2)


def resolve_adb_path() -> str:
    """Chemin de adb.exe. Priorité :

    1. adb.exe embarqué dans le package (déploiement exe autonome).
    2. adb_path de config.json (si présent et existe).
    3. Emplacement par défaut C:\\platform-tools\\adb.exe.
    4. Repli : PATH système.
    """
    # 1. ADB embarqué (le plus fiable pour un déploiement sans install).
    if BUNDLED_ADB.exists():
        return str(BUNDLED_ADB)
    # 2. Config utilisateur.
    cfg = load_config()
    p = cfg.get("adb_path")
    if p and os.path.exists(p):
        return p
    # 3. Emplacement par défaut.
    if os.path.exists(_DEFAULT_CONFIG["adb_path"]):
        return _DEFAULT_CONFIG["adb_path"]
    # 4. Repli PATH.
    return "adb"


def get_serial() -> str | None:
    """Serial de l'appareil issu du profil (None si pas de profil)."""
    profile = load_profile()
    if profile:
        return profile.get("serial")
    return None
