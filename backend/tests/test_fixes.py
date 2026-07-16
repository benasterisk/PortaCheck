"""Tests de régression pour les défauts trouvés par la revue de code multi-agents."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from phone_numbers import normalize_number, parse_import  # noqa: E402
from adb_parsers import parse_telephony, build_sim_status  # noqa: E402


# --- Finding : recompose sans verdict ne doit pas masquer le verdict décisif ---

@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    import config_loader
    db_file = tmp_path / "fixes.db"
    monkeypatch.setattr(config_loader, "DB_PATH", db_file)
    import database
    monkeypatch.setattr(database, "DB_PATH", db_file)
    database.init_db()
    return database


def test_recompose_without_verdict_keeps_decisive_verdict(temp_db):
    db = temp_db
    import report
    cid = db.create_campaign("Recompose")
    db.add_numbers(cid, [{"raw": "0612345678", "e164": "+33612345678", "national": "0612345678", "label": "A"}])
    nums = db.list_numbers(cid)
    run_id = db.create_run(cid, 1, "Orange", 1)

    # attempt 1 : composé puis verdict OK
    db.record_dial(run_id, nums[0]["id"], 1)
    db.record_verdict(run_id, nums[0]["id"], "OK", "aboutit", 5.0)
    # attempt 2 : recomposé mais laissé sans verdict
    db.record_dial(run_id, nums[0]["id"], 2)

    # get_call_for doit renvoyer le call AVEC verdict (attempt 1), pas le NULL.
    call = db.get_call_for(run_id, nums[0]["id"])
    assert call["verdict"] == "OK"

    # Le rapport garde le OK (Partiel en mono-passe), pas Non testé.
    rep = report.build_report(cid)
    assert rep["rows"][0]["cells"][run_id]["verdict"] == "OK"
    assert rep["rows"][0]["category"] == report.CAT_PARTIEL


def test_run_progress_counts_distinct_numbers(temp_db):
    """Un recompose re-verdicté ne doit pas faire dépasser done > total."""
    db = temp_db
    cid = db.create_campaign("Progress")
    db.add_numbers(cid, [{"raw": "0612345678", "e164": "+33612345678", "national": "0612345678", "label": ""}])
    nums = db.list_numbers(cid)
    run_id = db.create_run(cid, 1, "Orange", 1)

    db.record_dial(run_id, nums[0]["id"], 1)
    db.record_verdict(run_id, nums[0]["id"], "NOK")
    # recompose + nouveau verdict → 2 lignes calls verdictées pour le même numéro
    db.record_dial(run_id, nums[0]["id"], 2)
    db.record_verdict(run_id, nums[0]["id"], "OK")

    prog = db.run_progress(run_id)
    assert prog["total"] == 1
    assert prog["done"] == 1       # DISTINCT number_id, pas COUNT(*)
    assert prog["remaining"] == 0  # jamais négatif


def test_interrupted_run_is_not_dialable(temp_db):
    """next_pending_number sur run non 'en_cours' renvoie None (pas de dial après STOP)."""
    db = temp_db
    cid = db.create_campaign("Stop")
    db.add_numbers(cid, [{"raw": "0612345678", "e164": "+33612345678", "national": "0612345678", "label": ""}])
    run_id = db.create_run(cid, 1, "Orange", 1)
    db.set_run_status(run_id, "interrompue")
    assert db.next_pending_number(run_id) is None
    # terminée aussi
    db.set_run_status(run_id, "terminee", finished=True)
    assert db.next_pending_number(run_id) is None


# --- Finding : normalisation numéros ------------------------------------------

def test_normalize_rejects_non_ascii_digits():
    # Chiffres arabes-indiens précédés d'un 0 ASCII : doit être rejeté.
    with pytest.raises(ValueError):
        normalize_number("0" + "٦١١٣٢٦٧٨٩")
    # Chiffres exposants
    with pytest.raises(ValueError):
        normalize_number("0" + "¹" * 9)


def test_normalize_accepts_trunk_prefix_parentheses():
    # +33 (0)6… et 0033 (0)6… sont des notations FR courantes.
    for raw in ["+33 (0)6 12 34 56 78", "0033 (0)6 12 34 56 78", "+33(0)612345678"]:
        norm = normalize_number(raw)
        assert norm["e164"] == "+33612345678"
        assert norm["national"] == "0612345678"


def test_normalize_still_accepts_plain_formats():
    # Non-régression : les formats simples marchent toujours.
    for raw in ["0612345678", "+33612345678", "0033612345678", "33612345678"]:
        assert normalize_number(raw)["e164"] == "+33612345678"


# --- Finding : parsing telephony borné + mapping subId ------------------------

def test_last_phone_does_not_leak_from_tail():
    """Le dernier phoneId ne doit pas lire l'état réseau d'une section ultérieure."""
    synthetic = """last known state:
  Phone Id=0
    mCallState=0
    mServiceState={mVoiceRegState=1(OUT_OF_SERVICE), mOperatorAlphaLong=}
  Phone Id=1
    subId=1
    mCallState=0
    mServiceState=null
local logs:
  2026-01-01 - notifyServiceStateForSubscriber state={mVoiceRegState=0(IN_SERVICE), mOperatorAlphaLong=Orange F}
"""
    res = parse_telephony(synthetic)
    p1 = next(p for p in res["phones"] if p["phone_id"] == 1)
    # mServiceState=null → pas de fuite depuis 'local logs' → UNKNOWN, pas IN_SERVICE.
    assert p1["voice_reg_label"] == "UNKNOWN"
    assert p1["in_service"] is False


def test_sim_matched_by_subid_not_slot():
    """SIM en slot 0 mais enregistrée sur Phone Id=1 → doit être vue EN SERVICE."""
    isub = """SubscriptionManagerService:
mSimState[0]=LOADED
Active subscriptions:
  [SubscriptionInfoInternal: id=5 iccId=x simSlotIndex=0 carrierName=Free mcc=208 mnc=15 displayName=Free ]
"""
    telephony = """last known state:
  Phone Id=0
    subId=99
    mCallState=0
    mServiceState={mVoiceRegState=1(OUT_OF_SERVICE), mOperatorAlphaLong=}
  Phone Id=1
    subId=5
    mCallState=0
    mServiceState={mVoiceRegState=0(IN_SERVICE), mOperatorAlphaLong=Free}
"""
    cards = build_sim_status(isub, telephony)
    assert len(cards) == 1
    # subId=5 est sur Phone Id=1 (IN_SERVICE), même si slotIndex=0.
    assert cards[0]["sub_id"] == 5
    assert cards[0]["in_service"] is True
    assert cards[0]["service_label"] == "EN SERVICE"


def test_mono_sim_fixture_still_correct(isub_text, telephony_text):
    """Non-régression sur la vraie capture mono-SIM Orange."""
    cards = build_sim_status(isub_text, telephony_text)
    assert len(cards) == 1
    assert cards[0]["in_service"] is True
    assert "Orange" in cards[0]["operator"]
