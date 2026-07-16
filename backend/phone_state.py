"""État partagé du téléphone, rafraîchi périodiquement pour le WebSocket /ws/state.

Un thread de fond interroge ADB (dumpsys) à cadence adaptative :
  - au repos : poll_interval_idle_s (défaut 3 s)
  - pendant un appel : poll_interval_call_s (défaut 1 s)

L'état est mis en cache et exposé aux handlers HTTP et au WebSocket sans re-solliciter
ADB à chaque requête. Le chrono d'appel est calculé côté serveur à partir de la
transition IDLE→OFFHOOK.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime
from typing import Any

import adb_service as adb
import adb_parsers
from config_loader import load_config, load_profile


class PhoneStateMonitor:
    def __init__(self) -> None:
        cfg = load_config()
        self._idle_interval = cfg.get("poll_interval_idle_s", 3)
        self._call_interval = cfg.get("poll_interval_call_s", 1)
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

        # Cache SIM (rafraîchi à la demande, coûteux).
        self._sim_cards: list[dict[str, Any]] = []
        self._sim_error: str | None = None

        # État courant.
        self._state: dict[str, Any] = {
            "device_connected": False,
            "device_state": "absent",
            "call_state": 0,          # 0 IDLE / 1 RINGING / 2 OFFHOOK
            "call_active": False,
            "call_elapsed_s": 0.0,
            "sims": [],
            "sim_error": None,
            "ts": None,
        }
        self._call_started_at: float | None = None

    # --- Cycle de vie --------------------------------------------------------

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        # Inventaire SIM initial (best effort).
        self.refresh_sim_inventory()
        self._thread = threading.Thread(target=self._loop, name="phone-state", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)

    # --- Boucle de fond ------------------------------------------------------

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._poll_once()
            interval = self._call_interval if self._state["call_active"] else self._idle_interval
            self._stop.wait(interval)

    def _poll_once(self) -> None:
        connected = False
        device_state = "absent"
        call_state = 0
        try:
            device_state = adb.get_device_state()
            connected = device_state == "device"
        except Exception:
            connected = False
            device_state = "absent"

        if connected:
            try:
                raw = adb.dumpsys_telephony()
                call_state = adb_parsers.parse_call_state(raw)
            except Exception:
                call_state = 0

        call_active = call_state == 2

        # Gestion du chrono côté serveur.
        now_mono = time.monotonic()
        if call_active and self._call_started_at is None:
            self._call_started_at = now_mono
        elif not call_active:
            self._call_started_at = None
        elapsed = (now_mono - self._call_started_at) if (call_active and self._call_started_at) else 0.0

        with self._lock:
            self._state.update({
                "device_connected": connected,
                "device_state": device_state,
                "call_state": call_state,
                "call_active": call_active,
                "call_elapsed_s": round(elapsed, 1),
                "sims": self._sim_cards,
                "sim_error": self._sim_error,
                "ts": datetime.now().isoformat(timespec="seconds"),
            })

    # --- Inventaire SIM (à la demande) --------------------------------------

    def refresh_sim_inventory(self) -> list[dict[str, Any]]:
        """Relance dumpsys isub + telephony et met à jour les cartes SIM."""
        try:
            isub = adb.dumpsys_isub()
            tel = adb.dumpsys_telephony(quiet=False)
            profile = load_profile()
            cards = adb_parsers.build_sim_status(isub, tel, profile)
            with self._lock:
                self._sim_cards = cards
                self._sim_error = None
            return cards
        except adb.AdbError as e:
            with self._lock:
                self._sim_error = e.message_fr
            return self._sim_cards
        except Exception as e:  # pragma: no cover - robustesse
            with self._lock:
                self._sim_error = f"Erreur inventaire SIM : {e}"
            return self._sim_cards

    # --- Accès --------------------------------------------------------------

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._state)

    def get_sims(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._sim_cards)


# Instance unique partagée par l'application.
monitor = PhoneStateMonitor()
