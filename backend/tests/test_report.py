"""Tests de la classification automatique du rapport comparatif."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from report import (  # noqa: E402
    _classify,
    CAT_CONFORME,
    CAT_ROUTAGE,
    CAT_KO,
    CAT_PARTIEL,
    CAT_NON_TESTE,
)


def test_conforme_ok_ok():
    assert _classify(["OK", "OK"]) == CAT_CONFORME


def test_routage_ok_nok():
    assert _classify(["OK", "NOK"]) == CAT_ROUTAGE
    assert _classify(["NOK", "OK"]) == CAT_ROUTAGE


def test_portage_ko_nok_nok():
    assert _classify(["NOK", "NOK"]) == CAT_KO


def test_partiel_une_seule_passe_ok():
    # Cas mono-SIM : une seule passe faite.
    assert _classify(["OK", None]) == CAT_PARTIEL
    assert _classify(["OK"]) == CAT_PARTIEL


def test_partiel_une_seule_passe_nok():
    assert _classify(["NOK", None]) == CAT_PARTIEL
    assert _classify(["NOK"]) == CAT_PARTIEL


def test_non_teste_que_skip():
    assert _classify(["SKIP", "SKIP"]) == CAT_NON_TESTE
    assert _classify(["SKIP"]) == CAT_NON_TESTE


def test_non_teste_rien():
    assert _classify([None, None]) == CAT_NON_TESTE
    assert _classify([]) == CAT_NON_TESTE


def test_skip_ignore_pour_decisif():
    # SKIP sur une passe + OK sur l'autre = une seule passe décisive → Partiel.
    assert _classify(["OK", "SKIP"]) == CAT_PARTIEL
    # SKIP + OK + OK = deux décisifs OK → Conforme.
    assert _classify(["SKIP", "OK", "OK"]) == CAT_CONFORME


def test_trois_passes_mixte():
    # Trois passes avec au moins un OK et un NOK → routage suspect.
    assert _classify(["OK", "OK", "NOK"]) == CAT_ROUTAGE
    # Trois passes toutes NOK → KO.
    assert _classify(["NOK", "NOK", "NOK"]) == CAT_KO
