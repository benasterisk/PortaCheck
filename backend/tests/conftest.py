"""Fixtures pytest : chargement des captures Phase 0.

Les fichiers de samples/phase0/ ont été écrits par PowerShell en UTF-16.
On les lit en tolérant l'encodage puis on laisse les parseurs normaliser.
"""
from pathlib import Path

import pytest

SAMPLES = Path(__file__).resolve().parent.parent.parent / "samples" / "phase0"


def _read(name: str) -> str:
    """Lit une fixture en détectant l'encodage par le BOM.

    Les captures PowerShell sont hétérogènes : Tee-Object produit de l'UTF-16 LE
    (BOM FF FE), Out-File -Encoding utf8 produit de l'UTF-8 avec BOM (EF BB BF).
    On détecte le BOM plutôt que de deviner (deviner UTF-16 sur de l'UTF-8
    « réussit » silencieusement et corrompt le texte).
    """
    path = SAMPLES / name
    raw = path.read_bytes()
    if raw[:2] == b"\xff\xfe":
        return raw.decode("utf-16-le")
    if raw[:2] == b"\xfe\xff":
        return raw.decode("utf-16-be")
    if raw[:3] == b"\xef\xbb\xbf":
        return raw.decode("utf-8-sig")
    return raw.decode("utf-8", errors="replace")


@pytest.fixture
def isub_text() -> str:
    return _read("0.3_dumpsys_isub.txt")


@pytest.fixture
def telephony_text() -> str:
    return _read("0.4_dumpsys_telephony_registry.txt")
