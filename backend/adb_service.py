"""Wrapper subprocess autour de adb.exe — AUCUNE bibliothèque ADB tierce.

Toutes les commandes ADB passent par ici : timeout, capture stdout/stderr,
journalisation intégrale dans logs/adb.log (horodatage, commande, code retour,
sortie tronquée à 2000 caractères), et traduction des erreurs classiques
(device offline / unauthorized / adb absent) en messages français explicites.

Forme des commandes : [adb_path, "-s", serial, ...].
Timeout : 10 s par défaut, 30 s pour les dumpsys.
"""
from __future__ import annotations

import subprocess
import threading
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from config_loader import LOG_DIR, resolve_adb_path, get_serial

# --- Constantes ---------------------------------------------------------------

TIMEOUT_DEFAULT = 10
TIMEOUT_DUMPSYS = 30
_LOG_TRUNC = 2000
_LOG_FILE = LOG_DIR / "adb.log"

# Buffer mémoire des dernières commandes (pour la page Journal de l'UI).
_LOG_RING: deque[dict[str, Any]] = deque(maxlen=500)
_LOG_LOCK = threading.Lock()


# --- Erreurs ------------------------------------------------------------------

class AdbError(Exception):
    """Erreur ADB avec un message déjà traduit en français pour l'UI."""

    def __init__(self, message_fr: str, *, kind: str = "generic", raw: str = ""):
        super().__init__(message_fr)
        self.message_fr = message_fr
        self.kind = kind  # "absent" | "unauthorized" | "offline" | "timeout" | "no_device" | "generic"
        self.raw = raw


@dataclass
class AdbResult:
    ok: bool
    code: int
    stdout: str
    stderr: str
    command: list[str] = field(default_factory=list)
    duration_ms: int = 0


# --- Journalisation -----------------------------------------------------------

def _now_iso() -> str:
    return datetime.now().isoformat(timespec="milliseconds")


def _truncate(text: str, limit: int = _LOG_TRUNC) -> str:
    if text is None:
        return ""
    if len(text) <= limit:
        return text
    return text[:limit] + f"… [tronqué, {len(text)} car.]"


def _log_entry(command: list[str], code: int, stdout: str, stderr: str, duration_ms: int,
               error: str | None = None, to_file: bool = True) -> None:
    """Journalise une commande.

    Toujours dans le ring buffer mémoire (page Journal de l'UI). Dans le fichier
    logs/adb.log seulement si `to_file` (les actions : dial, hangup, verdict, bascule)
    OU en cas d'erreur — pour éviter que le polling d'état (toutes les 1–3 s) ne fasse
    exploser la taille du fichier.
    """
    ts = _now_iso()
    # On masque le serial dans le log affiché (bruit) mais on garde la commande lisible.
    cmd_str = " ".join(command)
    entry = {
        "ts": ts,
        "command": cmd_str,
        "code": code,
        "stdout": _truncate(stdout),
        "stderr": _truncate(stderr),
        "duration_ms": duration_ms,
        "error": error,
    }
    with _LOG_LOCK:
        _LOG_RING.append(entry)
        if not (to_file or error):
            return
        try:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            with open(_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(f"[{ts}] code={code} dur={duration_ms}ms cmd={cmd_str}\n")
                if error:
                    f.write(f"    ERREUR: {error}\n")
                if stdout.strip():
                    f.write(f"    OUT: {_truncate(stdout)}\n")
                if stderr.strip():
                    f.write(f"    ERR: {_truncate(stderr)}\n")
        except OSError:
            # Ne jamais faire planter une commande ADB à cause du log.
            pass


def get_recent_logs(limit: int = 200) -> list[dict[str, Any]]:
    """Renvoie les dernières entrées de journal (plus récentes en premier)."""
    with _LOG_LOCK:
        items = list(_LOG_RING)
    return list(reversed(items))[:limit]


# --- Traduction des erreurs ADB ----------------------------------------------

def _classify_error(stderr: str, stdout: str, code: int = 0) -> tuple[str, str] | None:
    """Reconnaît une erreur de connexion ADB. Renvoie (kind, message_fr) ou None.

    IMPORTANT : on n'analyse QUE stderr (là où adb écrit ses erreurs de transport),
    jamais stdout. Les sorties de dumpsys contiennent des données légitimes comme
    « ImsReasonInfo :: {404, Not Found} » ou « offline » qui déclencheraient de faux
    positifs « Aucun appareil détecté ». Les erreurs de connexion adb (no devices,
    device offline, device not found…) apparaissent toujours sur stderr.
    """
    err = (stderr or "").lower()
    if "unauthorized" in err:
        return ("unauthorized", "Téléphone non autorisé : acceptez la popup « Autoriser le débogage USB » sur l'appareil.")
    if "device offline" in err or "error: device offline" in err:
        return ("offline", "Téléphone hors ligne (device offline) : rebranchez le câble USB.")
    if ("no devices" in err or "device not found" in err
            or "no devices/emulators found" in err or "device '" in err and "not found" in err):
        return ("no_device", "Aucun appareil détecté : vérifiez le câble USB et le débogage USB.")
    if "more than one device" in err:
        return ("generic", "Plusieurs appareils détectés : un seul téléphone doit être branché.")
    return None


# --- Exécution ----------------------------------------------------------------

def _run(args: list[str], *, timeout: int = TIMEOUT_DEFAULT, use_serial: bool = True,
         to_file: bool = True) -> AdbResult:
    """Exécute une commande adb. args = arguments APRÈS 'adb -s <serial>'.

    Lève AdbError avec message français en cas d'échec identifiable.
    """
    adb = resolve_adb_path()
    command = [adb]
    if use_serial:
        serial = get_serial()
        if serial:
            command += ["-s", serial]
    command += args

    start = datetime.now()
    try:
        proc = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError:
        dur = int((datetime.now() - start).total_seconds() * 1000)
        msg = ("ADB introuvable : installez les platform-tools "
               "(https://developer.android.com/tools/releases/platform-tools) "
               "ou corrigez adb_path dans config.json.")
        _log_entry(command, -1, "", "FileNotFoundError", dur, error=msg)
        raise AdbError(msg, kind="absent")
    except subprocess.TimeoutExpired:
        dur = int((datetime.now() - start).total_seconds() * 1000)
        msg = f"Délai dépassé ({timeout}s) sur la commande ADB : {' '.join(args)}."
        _log_entry(command, -2, "", "TimeoutExpired", dur, error=msg)
        raise AdbError(msg, kind="timeout")

    dur = int((datetime.now() - start).total_seconds() * 1000)
    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    code = proc.returncode

    classified = _classify_error(stderr, stdout, code)
    error_msg = classified[1] if classified else (stderr.strip() if code != 0 else None)
    _log_entry(command, code, stdout, stderr, dur, error=error_msg, to_file=to_file)

    result = AdbResult(ok=(code == 0 and classified is None),
                       code=code, stdout=stdout, stderr=stderr,
                       command=command, duration_ms=dur)

    if classified is not None:
        raise AdbError(classified[1], kind=classified[0], raw=stderr)
    return result


# --- API publique : état & connectivité --------------------------------------

def list_devices(quiet: bool = True) -> list[dict[str, str]]:
    """Parse `adb devices -l`. Renvoie [{serial, state, model, ...}].

    quiet=True par défaut : cette commande est appelée en boucle par le monitor,
    on ne l'écrit pas dans le fichier de log (elle reste dans le ring buffer UI).
    """
    res = _run(["devices", "-l"], use_serial=False, to_file=not quiet)
    devices: list[dict[str, str]] = []
    for line in res.stdout.splitlines():
        line = line.strip()
        if not line or line.startswith("List of devices"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        entry = {"serial": parts[0], "state": parts[1]}
        for token in parts[2:]:
            if ":" in token:
                k, v = token.split(":", 1)
                entry[k] = v
        devices.append(entry)
    return devices


def is_device_connected() -> bool:
    """True si le serial du profil est présent et en état 'device'."""
    serial = get_serial()
    try:
        devices = list_devices()
    except AdbError:
        return False
    for d in devices:
        if serial is None or d["serial"] == serial:
            if d["state"] == "device":
                return True
    return False


def get_device_state() -> str:
    """Renvoie l'état de l'appareil cible : 'device', 'unauthorized', 'offline', 'absent'."""
    serial = get_serial()
    try:
        devices = list_devices()
    except AdbError as e:
        return "absent" if e.kind == "absent" else "absent"
    for d in devices:
        if serial is None or d["serial"] == serial:
            return d["state"]
    return "absent"


# --- API publique : dumpsys ---------------------------------------------------

def dumpsys_isub(quiet: bool = False) -> str:
    """Inventaire SIM brut (dumpsys isub). Loggé par défaut (action d'inventaire)."""
    return _run(["shell", "dumpsys", "isub"], timeout=TIMEOUT_DUMPSYS, to_file=not quiet).stdout


def dumpsys_telephony(quiet: bool = True) -> str:
    """État réseau/appel brut (dumpsys telephony.registry).

    quiet=True par défaut : appelé en boucle par le monitor d'état, non écrit
    dans le fichier de log.
    """
    return _run(["shell", "dumpsys", "telephony.registry"], timeout=TIMEOUT_DUMPSYS, to_file=not quiet).stdout


# --- API publique : SIM voix par défaut (bascule méthode A) -------------------

def get_voice_subid() -> str:
    """Lit settings global multi_sim_voice_call (subId de la SIM d'appel par défaut)."""
    return _run(["shell", "settings", "get", "global", "multi_sim_voice_call"]).stdout.strip()


def set_voice_subid(sub_id: int | str) -> str:
    """Écrit la SIM d'appel par défaut puis relit la valeur (relecture de contrôle).

    Renvoie la valeur relue. L'appelant compare pour décider du repli manual.
    """
    _run(["shell", "settings", "put", "global", "multi_sim_voice_call", str(sub_id)])
    return get_voice_subid()


# --- API publique : appel -----------------------------------------------------

def dial(number: str) -> AdbResult:
    """Compose un numéro via l'intent CALL. number déjà au format voulu (+33… ou 0…)."""
    return _run(["shell", "am", "start", "-a", "android.intent.action.CALL", "-d", f"tel:{number}"])


def hangup() -> AdbResult:
    """Raccroche l'appel en cours (KEYCODE_ENDCALL)."""
    return _run(["shell", "input", "keyevent", "KEYCODE_ENDCALL"])


def wakeup() -> AdbResult:
    """Réveille l'écran (KEYCODE_WAKEUP)."""
    return _run(["shell", "input", "keyevent", "KEYCODE_WAKEUP"])


def stay_on(enabled: bool) -> AdbResult:
    """Maintien de l'écran allumé tant que branché en USB (svc power stayon usb/false)."""
    value = "usb" if enabled else "false"
    return _run(["shell", "svc", "power", "stayon", value])


def get_call_state() -> int:
    """Renvoie le mCallState maximal parmi les phoneId (0=IDLE, 1=RINGING, 2=OFFHOOK).

    On prend le max : dès qu'une SIM est OFFHOOK, l'appel est actif.
    Import tardif pour éviter une dépendance circulaire au chargement.
    """
    from adb_parsers import parse_call_state
    raw = dumpsys_telephony()
    return parse_call_state(raw)
