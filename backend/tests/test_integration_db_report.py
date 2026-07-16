"""Test d'intégration : DB + rapport + exports sur une base temporaire.

On patche config_loader.DB_PATH vers un fichier temporaire pour ne pas toucher
la vraie portacheck.db.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402


@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    """Redirige la DB vers un fichier temporaire et initialise le schéma."""
    import config_loader
    db_file = tmp_path / "test_portacheck.db"
    monkeypatch.setattr(config_loader, "DB_PATH", db_file)
    import database
    monkeypatch.setattr(database, "DB_PATH", db_file)
    database.init_db()
    return database


def test_full_flow_mono_sim(temp_db):
    db = temp_db
    import report

    # Campagne + numéros
    cid = db.create_campaign("Site Test", "note")
    db.add_numbers(cid, [
        {"raw": "0600000000", "e164": "+33600000000", "national": "0600000000", "label": "A"},
        {"raw": "0147258369", "e164": "+33147258369", "national": "0147258369", "label": "B"},
        {"raw": "0354128481", "e164": "+33354128481", "national": "0354128481", "label": "Echo"},
    ])
    assert len(db.list_numbers(cid)) == 3

    # Passe Orange
    run_id = db.create_run(cid, sim_subid=1, sim_operator="Orange", sim_slot=1)

    # Reprise : premier numéro sans verdict = le premier (ord 0)
    nxt = db.next_pending_number(run_id)
    assert nxt["national"] == "0600000000"

    # Composer + verdict OK
    nums = db.list_numbers(cid)
    att = db.get_last_attempt(run_id, nums[0]["id"]) + 1
    db.record_dial(run_id, nums[0]["id"], att)
    db.record_verdict(run_id, nums[0]["id"], "OK", "aboutit", duration_s=5.0)

    # Après verdict, le prochain pending est le 2e numéro
    nxt2 = db.next_pending_number(run_id)
    assert nxt2["national"] == "0147258369"

    # 2e numéro NOK, 3e SKIP
    db.record_verdict(run_id, nums[1]["id"], "NOK", "ancienne infra")
    db.record_verdict(run_id, nums[2]["id"], "SKIP", "")

    prog = db.run_progress(run_id)
    assert prog["total"] == 3
    assert prog["done"] == 3
    assert prog["remaining"] == 0

    # Rapport mono-passe : OK→Partiel, NOK→Partiel, SKIP→Non testé
    rep = report.build_report(cid)
    by_num = {r["national"]: r for r in rep["rows"]}
    assert by_num["0600000000"]["category"] == report.CAT_PARTIEL
    assert by_num["0147258369"]["category"] == report.CAT_PARTIEL
    assert by_num["0354128481"]["category"] == report.CAT_NON_TESTE


def test_two_passes_classification(temp_db):
    db = temp_db
    import report

    cid = db.create_campaign("Deux passes")
    db.add_numbers(cid, [
        {"raw": "0611111111", "e164": "+33611111111", "national": "0611111111", "label": "conforme"},
        {"raw": "0622222222", "e164": "+33622222222", "national": "0622222222", "label": "routage"},
        {"raw": "0633333333", "e164": "+33633333333", "national": "0633333333", "label": "ko"},
    ])
    nums = db.list_numbers(cid)

    # Passe Orange : OK / OK / NOK
    r1 = db.create_run(cid, 1, "Orange", 1)
    db.record_verdict(r1, nums[0]["id"], "OK")
    db.record_verdict(r1, nums[1]["id"], "OK")
    db.record_verdict(r1, nums[2]["id"], "NOK")

    # Passe Free : OK / NOK / NOK
    r2 = db.create_run(cid, 2, "Free", 0)
    db.record_verdict(r2, nums[0]["id"], "OK")
    db.record_verdict(r2, nums[1]["id"], "NOK")
    db.record_verdict(r2, nums[2]["id"], "NOK")

    rep = report.build_report(cid)
    by_num = {r["label"]: r for r in rep["rows"]}
    assert by_num["conforme"]["category"] == report.CAT_CONFORME
    assert by_num["routage"]["category"] == report.CAT_ROUTAGE
    assert by_num["ko"]["category"] == report.CAT_KO
    assert rep["summary"][report.CAT_CONFORME] == 1
    assert rep["summary"][report.CAT_ROUTAGE] == 1
    assert rep["summary"][report.CAT_KO] == 1


def test_exports_produce_output(temp_db):
    db = temp_db
    import report

    cid = db.create_campaign("Export")
    db.add_numbers(cid, [
        {"raw": "0600000000", "e164": "+33600000000", "national": "0600000000", "label": "A"},
    ])
    nums = db.list_numbers(cid)
    r1 = db.create_run(cid, 1, "Orange", 1)
    db.record_verdict(r1, nums[0]["id"], "OK", "ok", 4.2)

    csv_name, csv_content = report.export_csv(cid)
    assert csv_name.startswith("rapport_Export_")
    assert csv_name.endswith(".csv")
    assert "0600000000" in csv_content
    assert ";" in csv_content

    xlsx_name, xlsx_bytes = report.export_xlsx(cid)
    assert xlsx_name.endswith(".xlsx")
    # Signature ZIP (xlsx = zip)
    assert xlsx_bytes[:2] == b"PK"


def test_resume_after_partial(temp_db):
    """Reprise : après un STOP, next_pending reprend au 1er sans verdict."""
    db = temp_db
    cid = db.create_campaign("Reprise")
    db.add_numbers(cid, [
        {"raw": f"061111111{i}", "e164": f"+3361111111{i}", "national": f"061111111{i}", "label": ""}
        for i in range(5)
    ])
    nums = db.list_numbers(cid)
    run_id = db.create_run(cid, 1, "Orange", 1)

    # Traiter les 2 premiers puis STOP
    db.record_verdict(run_id, nums[0]["id"], "OK")
    db.record_verdict(run_id, nums[1]["id"], "OK")
    db.set_run_status(run_id, "interrompue")

    # Une passe interrompue est vue comme finie tant qu'on ne la reprend pas
    # explicitement (garde-fou : pas de composition résiduelle après STOP).
    assert db.next_pending_number(run_id) is None
    # only_active=False permet de calculer le point de reprise (3e numéro, ord 2).
    nxt = db.next_pending_number(run_id, only_active=False)
    assert nxt["id"] == nums[2]["id"]
    # Après réactivation (reprise explicite), la passe redevient utilisable.
    db.set_run_status(run_id, "en_cours")
    assert db.next_pending_number(run_id)["id"] == nums[2]["id"]
