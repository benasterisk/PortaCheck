"""Tests des parseurs dumpsys sur les fixtures réelles de la Phase 0.

Contexte device : Galaxy A25 mono-SIM Orange (subId=1, slotIndex=1), slot 0 ABSENT.
"""
import sys
from pathlib import Path

# Rendre le paquet backend/ importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from adb_parsers import (  # noqa: E402
    parse_isub,
    parse_telephony,
    parse_call_state,
    build_sim_status,
)


# --- parse_isub ---------------------------------------------------------------

def test_isub_active_count_mono_sim(isub_text):
    result = parse_isub(isub_text)
    assert result["active_count"] == 1, "Une seule SIM active attendue (Orange)"


def test_isub_sim_states(isub_text):
    result = parse_isub(isub_text)
    assert result["sim_states"].get(0) == "ABSENT"
    assert result["sim_states"].get(1) == "LOADED"


def test_isub_default_voice_subid(isub_text):
    result = parse_isub(isub_text)
    assert result["default_voice_subid"] == 1


def test_isub_sim_fields(isub_text):
    result = parse_isub(isub_text)
    sim = result["sims"][0]
    assert sim["sub_id"] == 1
    assert sim["slot_index"] == 1
    assert sim["carrier_name"] == "Orange F"
    assert sim["mcc"] == "208"
    assert sim["mnc"] == "01"


def test_isub_ignores_inactive_subs(isub_text):
    # "All subscriptions" contient id=2 et id=3 avec slotIndex=-1 : ne doivent pas
    # apparaître dans l'inventaire actif.
    result = parse_isub(isub_text)
    sub_ids = {s["sub_id"] for s in result["sims"]}
    assert sub_ids == {1}, "Seule la SIM active (id=1) doit être retenue"


# --- parse_telephony ----------------------------------------------------------

def test_telephony_two_phones(telephony_text):
    result = parse_telephony(telephony_text)
    phone_ids = {p["phone_id"] for p in result["phones"]}
    assert 0 in phone_ids and 1 in phone_ids


def test_telephony_phone0_out_of_service(telephony_text):
    result = parse_telephony(telephony_text)
    p0 = next(p for p in result["phones"] if p["phone_id"] == 0)
    assert p0["in_service"] is False
    assert p0["voice_reg_label"] == "OUT_OF_SERVICE"


def test_telephony_phone1_in_service_orange(telephony_text):
    result = parse_telephony(telephony_text)
    p1 = next(p for p in result["phones"] if p["phone_id"] == 1)
    assert p1["in_service"] is True
    assert p1["voice_reg_label"] == "IN_SERVICE"
    assert "Orange" in p1["operator"]


def test_telephony_call_state_idle(telephony_text):
    # Capture prise au repos : mCallState=0 partout.
    result = parse_telephony(telephony_text)
    assert result["call_state"] == 0


def test_parse_call_state_shortcut(telephony_text):
    assert parse_call_state(telephony_text) == 0


# --- build_sim_status (corrélation) ------------------------------------------

def test_build_sim_status_mono_sim(isub_text, telephony_text):
    cards = build_sim_status(isub_text, telephony_text)
    assert len(cards) == 1
    card = cards[0]
    assert card["sub_id"] == 1
    assert card["slot_index"] == 1
    assert card["in_service"] is True
    assert card["reachable"] is True
    assert card["service_label"] == "EN SERVICE"
    assert "Orange" in card["operator"]


# --- Parsing OFFHOOK synthétique (appel actif) -------------------------------

def test_parse_call_state_offhook_synthetic():
    # Simule un dumpsys avec un phoneId OFFHOOK (mCallState=2) → global doit valoir 2.
    synthetic = """
last known state:
  Phone Id=0
    mCallState=0
    mServiceState={mVoiceRegState=1(OUT_OF_SERVICE), ...}
  Phone Id=1
    mCallState=2
    mServiceState={mVoiceRegState=0(IN_SERVICE), mOperatorAlphaLong=Orange F, ...}
"""
    assert parse_call_state(synthetic) == 2
    result = parse_telephony(synthetic)
    p1 = next(p for p in result["phones"] if p["phone_id"] == 1)
    assert p1["call_state"] == 2


def test_parse_isub_empty_input():
    # Robustesse : entrée vide ne doit pas planter.
    result = parse_isub("")
    assert result["active_count"] == 0
    assert result["sims"] == []


def test_parse_telephony_empty_input():
    result = parse_telephony("")
    assert result["call_state"] == 0
    assert result["phones"] == []
