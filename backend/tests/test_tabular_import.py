"""Tests import tabulaire (détection colonnes, mapping, extras) + commentaire horodaté."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

import tabular_import as ti  # noqa: E402


# Grille type « listing SDA » (8 colonnes comme le vrai fichier utilisateur).
SDA_GRID = [
    ["Listing unitaire des SDA à porter", "", "", "", "", "", "", ""],  # titre
    ["", "", "", "", "", "", "", ""],                                     # ligne vide
    ["N°", "Site", "Numéro (SDA)", "Numéro brut", "Rattachement", "Type", "Tranche", "Test"],  # en-tête
    ["1", "THIAIS", "01 45 12 40 00", "0145124000", "BTIP 0156301530", "Voix", "…→…09", "ok"],
    ["2", "THIAIS", "01 45 12 40 01", "0145124001", "BTIP 0156301530", "Voix", "…→…09", "ok"],
    ["3", "LES ESSARTS", "02 51 96 68 30", "0251966830", "BTIP", "Voix", "…", ""],
    ["4", "FAX — hors BTIP", "", "", "", "", "", ""],  # ligne sans numéro (comme la ligne FAX)
]


def test_find_header_row_skips_title():
    idx = ti._find_header_row(SDA_GRID)
    assert idx == 2  # la vraie ligne d'en-tête, pas le titre


def test_analyze_detects_number_column():
    a = ti.analyze(SDA_GRID)
    # La colonne 3 (« Numéro brut ») a 100% de numéros valides → devinée.
    assert a["number_col_guess"] == 3
    cols = {c["index"]: c for c in a["columns"]}
    assert cols[3]["name"] == "Numéro brut"
    assert cols[3]["number_score"] == 1.0


# --- Fichier SANS ligne d'en-tête (données dès la 1re ligne) ------------------

NO_HEADER_GRID = [
    ["0146870721", "0146870933", "Message Orange non attribué"],
    ["0146870722", "0146870934", "Autre message"],
    ["0146870723", "0146870935", "Encore un"],
]


def test_no_header_detected():
    # Aucune ligne d'en-tête crédible (numéros dès la 1re ligne) → -1.
    assert ti._find_header_row(NO_HEADER_GRID) == -1


def test_analyze_no_header_generic_names():
    a = ti.analyze(NO_HEADER_GRID)
    assert a["header_row"] == -1
    # Toutes les lignes sont des données (3, pas 2).
    assert a["data_row_count"] == 3
    # Noms de colonnes génériques (pas les données de la 1re ligne).
    names = [c["name"] for c in a["columns"]]
    assert names == ["Colonne 1", "Colonne 2", "Colonne 3"]
    # La colonne numéro est bien devinée (col 0 ou 1, 100%).
    assert a["number_col_guess"] in (0, 1)


def test_build_numbers_no_header_keeps_all_rows():
    a = ti.analyze(NO_HEADER_GRID)
    result = ti.build_numbers(NO_HEADER_GRID, a["header_row"], 0, None)
    assert result["counts"]["valid"] == 3  # les 3 lignes, aucune perdue
    first = result["valid"][0]
    assert first["national"] == "0146870721"
    # extras avec noms génériques, pas de clé « données ».
    assert first["extras"]["Colonne 1"] == "0146870721"
    assert first["extras"]["Colonne 3"] == "Message Orange non attribué"


def test_analyze_detects_label_column():
    a = ti.analyze(SDA_GRID)
    # « Site » doit être devinée comme libellé (mot-clé + texte).
    assert a["label_col_guess"] == 1


def test_analyze_column_samples():
    a = ti.analyze(SDA_GRID)
    cols = {c["index"]: c for c in a["columns"]}
    assert "THIAIS" in cols[1]["samples"]


def test_build_numbers_with_mapping_keeps_extras():
    result = ti.build_numbers(SDA_GRID, header_row=2, number_col=3, label_col=1)
    assert result["counts"]["valid"] == 3   # 3 numéros valides
    assert result["counts"]["rejected"] == 1  # la ligne FAX sans numéro
    first = result["valid"][0]
    assert first["e164"] == "+33145124000"
    assert first["label"] == "THIAIS"
    # extras contient TOUTES les colonnes non vides de la ligne.
    assert first["extras"]["Site"] == "THIAIS"
    assert first["extras"]["Rattachement"] == "BTIP 0156301530"
    assert first["extras"]["Type"] == "Voix"


def test_build_numbers_dedup():
    grid = [
        ["Numéro brut", "Site"],
        ["0600000000", "A"],
        ["0600000000", "B"],  # doublon
    ]
    result = ti.build_numbers(grid, header_row=0, number_col=0, label_col=1)
    assert result["counts"]["valid"] == 1
    assert result["counts"]["duplicates"] == 1


def test_read_delimited_csv():
    data = "Numéro;Site\n0145124000;THIAIS\n0145124001;THIAIS\n".encode("utf-8")
    grid = ti.read_delimited(data)
    assert grid[0] == ["Numéro", "Site"]
    assert grid[1] == ["0145124000", "THIAIS"]


def test_read_delimited_tsv():
    data = "Numéro\tSite\n0145124000\tTHIAIS\n".encode("utf-8")
    grid = ti.read_delimited(data)
    assert grid[1] == ["0145124000", "THIAIS"]


# --- Commentaire horodaté (append) --------------------------------------------

@pytest.fixture
def temp_db(tmp_path, monkeypatch):
    import config_loader
    db_file = tmp_path / "tab.db"
    monkeypatch.setattr(config_loader, "DB_PATH", db_file)
    import database
    monkeypatch.setattr(database, "DB_PATH", db_file)
    database.init_db()
    return database


def test_comment_appends_with_timestamp(temp_db):
    db = temp_db
    cid = db.create_campaign("C")
    db.add_numbers(cid, [{"raw": "0600000000", "e164": "+33600000000", "national": "0600000000", "label": ""}])
    nums = db.list_numbers(cid)
    run_id = db.create_run(cid, 1, "Orange", 1)

    # 1er verdict avec commentaire
    db.record_verdict(run_id, nums[0]["id"], "NOK", "sonne dans le vide")
    hist1 = db.get_accumulated_comment(run_id, nums[0]["id"])
    assert "sonne dans le vide" in hist1
    assert hist1.startswith("[")  # horodatage présent
    assert hist1.count("\n") == 0  # une seule ligne

    # 2e note (ex. après recompose) : doit s'ajouter à la suite
    db.record_dial(run_id, nums[0]["id"], 2)
    db.record_verdict(run_id, nums[0]["id"], "OK", "rappel : ça passe maintenant")
    hist2 = db.get_accumulated_comment(run_id, nums[0]["id"])
    assert "sonne dans le vide" in hist2
    assert "ça passe maintenant" in hist2
    assert hist2.count("\n") == 1  # deux lignes horodatées


def test_comment_empty_note_keeps_history(temp_db):
    db = temp_db
    cid = db.create_campaign("C")
    db.add_numbers(cid, [{"raw": "0600000000", "e164": "+33600000000", "national": "0600000000", "label": ""}])
    nums = db.list_numbers(cid)
    run_id = db.create_run(cid, 1, "Orange", 1)
    db.record_verdict(run_id, nums[0]["id"], "NOK", "première note")
    # Verdict suivant SANS commentaire : l'historique existant est conservé.
    db.record_dial(run_id, nums[0]["id"], 2)
    db.record_verdict(run_id, nums[0]["id"], "OK", "")
    hist = db.get_accumulated_comment(run_id, nums[0]["id"])
    assert "première note" in hist


def test_extras_roundtrip_through_db(temp_db):
    db = temp_db
    cid = db.create_campaign("C")
    db.add_numbers(cid, [{
        "raw": "0145124000", "e164": "+33145124000", "national": "0145124000",
        "label": "THIAIS", "extras": {"Site": "THIAIS", "Rattachement": "BTIP"},
    }])
    nums = db.list_numbers(cid)
    assert nums[0]["extras"]["Site"] == "THIAIS"
    assert nums[0]["extras"]["Rattachement"] == "BTIP"
