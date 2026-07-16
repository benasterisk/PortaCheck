"""Tests de la classification d'erreurs ADB (faux positifs sur stdout)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from adb_service import _classify_error  # noqa: E402


# --- Faux positifs : stdout de données ne doit JAMAIS être classé comme erreur ---

def test_dumpsys_not_found_in_stdout_is_not_no_device():
    """Régression : 'Not Found' dans un ImsReasonInfo (données) ≠ appareil absent."""
    stdout = ("mImsCallDisconnectCause=ImsReasonInfo :: "
              "{1515 : CODE_UNOBTAINABLE_NUMBER, 404, Not Found}")
    assert _classify_error("", stdout, code=0) is None


def test_dumpsys_offline_in_stdout_is_not_error():
    """'offline' dans les données réseau ne doit pas déclencher 'device offline'."""
    stdout = "mDataConnectionState=offline networkType=LTE"
    assert _classify_error("", stdout, code=0) is None


def test_long_dumpsys_with_various_words_is_clean():
    stdout = "no devices here in this text, device not found in logs, offline mentioned"
    # Tout ça est dans stdout (données) → aucune erreur.
    assert _classify_error("", stdout, code=0) is None


# --- Vrais positifs : ces erreurs apparaissent sur stderr ---------------------

def test_unauthorized_on_stderr():
    r = _classify_error("error: device unauthorized.", "", code=1)
    assert r is not None and r[0] == "unauthorized"


def test_offline_on_stderr():
    r = _classify_error("error: device offline", "", code=1)
    assert r is not None and r[0] == "offline"


def test_no_device_on_stderr():
    r = _classify_error("error: no devices/emulators found", "", code=1)
    assert r is not None and r[0] == "no_device"


def test_device_not_found_on_stderr():
    r = _classify_error("error: device 'EMULATOR30X0' not found", "", code=1)
    assert r is not None and r[0] == "no_device"


def test_more_than_one_device_on_stderr():
    r = _classify_error("adb: more than one device/emulator", "", code=1)
    assert r is not None and r[0] == "generic"


def test_clean_success():
    assert _classify_error("", "Orange F IN_SERVICE", code=0) is None
