"""Point d'entrée de l'exécutable autonome PortaCheck.

Démarre le serveur (uvicorn) en interne et ouvre le navigateur. Conçu pour être
figé par PyInstaller en un seul .exe embarquant Python, les dépendances, le build
du frontend et adb.exe. Aucune installation requise côté technicien.
"""
from __future__ import annotations

import os
import sys
import threading
import time
import webbrowser

# S'assurer que le paquet backend/ est importable, aussi bien en dev qu'en exe.
_here = os.path.dirname(os.path.abspath(__file__))
_backend = os.path.join(_here, "backend")
if os.path.isdir(_backend) and _backend not in sys.path:
    sys.path.insert(0, _backend)
# En exe PyInstaller, backend/ est extrait dans _MEIPASS.
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    meipass_backend = os.path.join(sys._MEIPASS, "backend")
    if os.path.isdir(meipass_backend) and meipass_backend not in sys.path:
        sys.path.insert(0, meipass_backend)


def _open_browser_later(url: str, delay: float = 2.0) -> None:
    def _open():
        time.sleep(delay)
        try:
            webbrowser.open(url)
        except Exception:
            pass
    threading.Thread(target=_open, daemon=True).start()


def main() -> None:
    import uvicorn
    from config_loader import load_config

    cfg = load_config()
    port = int(cfg.get("port", 8765))
    url = f"http://localhost:{port}"

    print("=" * 50)
    print("  PortaCheck")
    print("=" * 50)
    print(f"  Serveur : {url}")
    print("  Laissez cette fenetre ouverte pendant l'utilisation.")
    print("  Fermez-la (ou Ctrl+C) pour arreter l'application.")
    print("=" * 50)

    if cfg.get("open_browser_on_start", True):
        _open_browser_later(url)

    # Importer l'app FastAPI (déclenche init DB + monitor au startup).
    from main import app

    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")


if __name__ == "__main__":
    main()
