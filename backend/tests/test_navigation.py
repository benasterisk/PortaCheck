"""Tests navigation libre, correction de verdict, suggestions de commentaires."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    import config_loader
    db_file = tmp_path / "nav.db"
    monkeypatch.setattr(config_loader, "DB_PATH", db_file)
    import database
    monkeypatch.setattr(database, "DB_PATH", db_file)
    database.init_db()
    return database


def _setup(db, n=4):
    cid = db.create_campaign("Nav")
    db.add_numbers(cid, [
        {"raw": f"06111111{i:02d}", "e164": f"+336111111{i:02d}", "national": f"06111111{i:02d}",
         "label": f"S{i}", "extras": {"Site": f"S{i}"}}
        for i in range(n)
    ])
    run_id = db.create_run(cid, 1, "Orange", 1)
    return cid, run_id, db.list_numbers(cid)


# --- Navigation ---------------------------------------------------------------

def test_list_run_numbers_states(temp_db):
    db = temp_db
    cid, run_id, nums = _setup(db)
    # Traiter le 1er (OK) et le 3e (NOK)
    db.record_verdict(run_id, nums[0]["id"], "OK", "aboutit")
    db.record_verdict(run_id, nums[2]["id"], "NOK", "ancienne infra")

    items = db.list_run_numbers(run_id)
    assert len(items) == 4
    assert items[0]["verdict"] == "OK"
    assert "aboutit" in items[0]["comment"]
    assert items[1]["verdict"] is None  # non traité
    assert items[2]["verdict"] == "NOK"
    assert items[3]["verdict"] is None
    # index et extras présents
    assert items[0]["index"] == 0
    assert items[0]["extras"]["Site"] == "S0"


def test_get_run_number_at(temp_db):
    db = temp_db
    cid, run_id, nums = _setup(db)
    item = db.get_run_number_at(run_id, 2)
    assert item["id"] == nums[2]["id"]
    assert db.get_run_number_at(run_id, 99) is None
    assert db.get_run_number_at(run_id, -1) is None


# --- Correction de verdict (remplace) + commentaire (ajoute) ------------------

def test_verdict_correction_replaces_but_comment_appends(temp_db):
    db = temp_db
    cid, run_id, nums = _setup(db)
    # 1er verdict
    db.record_verdict(run_id, nums[0]["id"], "NOK", "sonne dans le vide")
    item = db.get_run_number_at(run_id, 0)
    assert item["verdict"] == "NOK"
    # Correction : nouveau verdict OK + nouvelle note
    db.record_verdict(run_id, nums[0]["id"], "OK", "en fait ça passe")
    item2 = db.get_run_number_at(run_id, 0)
    assert item2["verdict"] == "OK"                    # verdict remplacé
    assert "sonne dans le vide" in item2["comment"]    # ancien commentaire gardé
    assert "en fait ça passe" in item2["comment"]      # nouveau ajouté
    assert item2["comment"].count("\n") == 1           # 2 lignes horodatées


def test_redial_verdicted_number_creates_attempt(temp_db):
    db = temp_db
    cid, run_id, nums = _setup(db)
    db.record_verdict(run_id, nums[0]["id"], "NOK")
    # Relancer un appel (recompose) sur ce numéro déjà traité
    att = db.get_last_attempt(run_id, nums[0]["id"]) + 1
    assert att == 2
    db.record_dial(run_id, nums[0]["id"], att)
    # Nouveau verdict sur la nouvelle tentative
    db.record_verdict(run_id, nums[0]["id"], "OK")
    item = db.get_run_number_at(run_id, 0)
    assert item["verdict"] == "OK"
    assert item["attempts"] == 2


# --- Suggestions de commentaires ---------------------------------------------

def test_comment_suggestions_enrich_on_verdict(temp_db):
    db = temp_db
    cid, run_id, nums = _setup(db)
    db.record_verdict(run_id, nums[0]["id"], "NOK", "sonne dans le vide")
    db.record_verdict(run_id, nums[1]["id"], "NOK", "sonne dans le vide")  # même note
    db.record_verdict(run_id, nums[2]["id"], "OK", "annonce nouvelle infra")

    sugg = db.list_comment_suggestions()
    texts = {s["text"]: s["count"] for s in sugg}
    assert texts.get("sonne dans le vide") == 2   # comptée 2 fois
    assert texts.get("annonce nouvelle infra") == 1
    # La plus fréquente en premier
    assert sugg[0]["text"] == "sonne dans le vide"


def test_comment_suggestion_ignores_empty(temp_db):
    db = temp_db
    cid, run_id, nums = _setup(db)
    db.record_verdict(run_id, nums[0]["id"], "SKIP", "")  # pas de commentaire
    assert db.list_comment_suggestions() == []
