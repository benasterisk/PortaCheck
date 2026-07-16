"""Tests de normalisation et d'import des numéros FR."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402

from phone_numbers import normalize_number, parse_import  # noqa: E402


# --- normalize_number : formats acceptés -------------------------------------

@pytest.mark.parametrize("raw,e164,national", [
    ("0612345678", "+33612345678", "0612345678"),
    ("+33612345678", "+33612345678", "0612345678"),
    ("0033612345678", "+33612345678", "0612345678"),
    ("06 12 34 56 78", "+33612345678", "0612345678"),
    ("06.12.34.56.78", "+33612345678", "0612345678"),
    ("06-12-34-56-78", "+33612345678", "0612345678"),
    ("(0)6 12 34 56 78".replace("(0)", "0"), "+33612345678", "0612345678"),
    ("+33 6 12 34 56 78", "+33612345678", "0612345678"),
    ("0354128481", "+33354128481", "0354128481"),   # Asterisk echo test number
    ("33612345678", "+33612345678", "0612345678"),
])
def test_normalize_accepts(raw, e164, national):
    norm = normalize_number(raw)
    assert norm["e164"] == e164
    assert norm["national"] == national


# --- normalize_number : rejets ------------------------------------------------

@pytest.mark.parametrize("raw", [
    "",
    "   ",
    "abc",
    "061132678",       # 9 chiffres (trop court)
    "06123456786",     # 11 chiffres (trop long)
    "0011326786",      # chiffre après 0 = 0 → invalide
    "+33061132678",    # 0 après indicatif
    "1234",
    "+44123456789",    # non FR
    "tel:0612345678",  # préfixe non nettoyé
])
def test_normalize_rejects(raw):
    with pytest.raises(ValueError):
        normalize_number(raw)


# --- parse_import : cas nominal ----------------------------------------------

def test_parse_import_basic():
    text = """0612345678
0147258369;Site Paris
+33354128481,Echo test
"""
    res = parse_import(text)
    assert res.counts["valid"] == 3
    assert res.counts["rejected"] == 0
    # Libellés récupérés
    labels = {v["e164"]: v["label"] for v in res.valid}
    assert labels["+33147258369"] == "Site Paris"
    assert labels["+33354128481"] == "Echo test"
    assert labels["+33612345678"] == ""


def test_parse_import_dedup_internal():
    text = "0612345678\n06 12 34 56 78\n0612345678"
    res = parse_import(text)
    assert res.counts["valid"] == 1
    assert res.counts["duplicates"] == 2


def test_parse_import_dedup_vs_existing():
    text = "0612345678\n0147258369"
    res = parse_import(text, existing={"+33612345678"})
    assert res.counts["valid"] == 1
    assert res.counts["duplicates"] == 1
    assert res.valid[0]["e164"] == "+33147258369"


def test_parse_import_rejects_listed():
    text = "0612345678\nPASNUMERO\n061132678"
    res = parse_import(text)
    assert res.counts["valid"] == 1
    assert res.counts["rejected"] == 2
    reasons = [r["raw"] for r in res.rejected]
    assert "PASNUMERO" in reasons


def test_parse_import_tab_separator():
    text = "0612345678\tSite A\n0147258369\tSite B"
    res = parse_import(text)
    assert res.counts["valid"] == 2
    assert res.valid[0]["label"] == "Site A"


def test_parse_import_skips_header():
    text = "numero;libelle\n0612345678;Site A"
    res = parse_import(text)
    assert res.counts["valid"] == 1
    assert res.valid[0]["label"] == "Site A"


def test_parse_import_ignores_blank_lines():
    text = "\n0612345678\n\n\n0147258369\n"
    res = parse_import(text)
    assert res.counts["valid"] == 2
