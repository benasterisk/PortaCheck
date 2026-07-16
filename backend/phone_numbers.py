"""Normalisation et import des numéros (téléphonie FR).

Règles (CLAUDE.md §6.1) :
  - Nettoyage : espaces, points, tirets, parenthèses, slashs.
  - Formats acceptés : 0X…, +33X…, 0033X… → stockés en E.164 (+33XXXXXXXXX)
    ET national (0XXXXXXXXX).
  - Rejet clair de tout ce qui n'est pas un numéro FR à 10 chiffres (ou E.164 FR valide).
  - Dédoublonnage sur E.164 avec compte rendu.
  - Import : upload CSV/TXT ou collage brut ; par ligne « numéro » ou « numéro;libellé »
    (séparateurs ; , ou tabulation).

On reste sur le périmètre FR (métier : SDA françaises). Un numéro FR national valide
commence par 0 suivi d'un chiffre 1–9 (les 0X où X∈1..9), soit 10 chiffres.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any


# Caractères de mise en forme à retirer (garde + et chiffres).
_CLEAN_RE = re.compile(r"[\s.\-()/_]")
# Séparateurs numéro / libellé.
_SPLIT_RE = re.compile(r"[;,\t]")


@dataclass
class ImportResult:
    valid: list[dict[str, Any]] = field(default_factory=list)      # {raw,e164,national,label}
    rejected: list[dict[str, str]] = field(default_factory=list)   # {raw,reason}
    duplicates: list[dict[str, str]] = field(default_factory=list) # {raw,e164} (doublons internes ou vs existant)

    @property
    def counts(self) -> dict[str, int]:
        return {
            "valid": len(self.valid),
            "rejected": len(self.rejected),
            "duplicates": len(self.duplicates),
        }

    def as_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "rejected": self.rejected,
            "duplicates": self.duplicates,
            "counts": self.counts,
        }


def _is_ascii_digits(s: str) -> bool:
    """True si s est non vide et composé UNIQUEMENT de chiffres ASCII 0-9.

    str.isdigit() est Unicode-aware (accepte ٦, ¹, …) et produirait un E.164
    non composable ; on impose donc l'ASCII strict.
    """
    return bool(s) and all("0" <= c <= "9" for c in s)


def normalize_number(raw: str) -> dict[str, str]:
    """Normalise un numéro FR. Renvoie {e164, national} ou lève ValueError(message_fr).

    Accepte : 0XXXXXXXXX, +33XXXXXXXXX, 0033XXXXXXXXX, 33XXXXXXXXX, et la notation
    internationale avec préfixe national entre parenthèses « +33 (0)X… » / « 0033 (0)X… »
    (le « (0) » est nettoyé en « 0 » puis retiré comme trunk prefix).
    Le chiffre après l'indicatif doit être 1–9 (pas de 0 en tête de SDA FR).
    """
    if raw is None:
        raise ValueError("Numéro vide")
    cleaned = _CLEAN_RE.sub("", raw.strip())
    if not cleaned:
        raise ValueError("Numéro vide")

    # Isoler le « reste » après l'indicatif pays selon le préfixe.
    # is_international : le préfixe est un indicatif pays (+33 / 0033 / 33), auquel
    # cas un « 0 » de trunk résiduel (issu de « (0) ») doit être retiré.
    if cleaned.startswith("+33"):
        rest = cleaned[3:]
        is_international = True
    elif cleaned.startswith("0033"):
        rest = cleaned[4:]
        is_international = True
    elif cleaned.startswith("33") and len(cleaned) in (11, 12):
        # 33 + 9 chiffres (11), ou 33 + 0 + 9 chiffres (12, trunk prefix).
        rest = cleaned[2:]
        is_international = True
    elif cleaned.startswith("0"):
        rest = cleaned[1:]  # national : le 0 est le trunk prefix
        is_international = False
    else:
        raise ValueError("Format non reconnu (attendu 0X…, +33X… ou 0033X…)")

    # Après un indicatif international, un « 0 » de trunk peut subsister
    # (ex. +33 (0)6… → rest = '06…'). On le retire.
    if is_international and rest.startswith("0"):
        rest = rest[1:]

    digits_9 = rest
    if not _is_ascii_digits(digits_9):
        raise ValueError("Le numéro contient des caractères non numériques")
    if len(digits_9) != 9:
        raise ValueError(f"Numéro FR invalide (9 chiffres attendus après l'indicatif, reçu {len(digits_9)})")
    if digits_9[0] == "0":
        raise ValueError("Numéro FR invalide (le chiffre après l'indicatif ne peut être 0)")

    e164 = "+33" + digits_9
    national = "0" + digits_9
    return {"e164": e164, "national": national}


def _split_line(line: str) -> tuple[str, str]:
    """Sépare une ligne en (numéro, libellé). Le libellé peut contenir des espaces."""
    parts = _SPLIT_RE.split(line, maxsplit=1)
    number = parts[0].strip()
    label = parts[1].strip() if len(parts) > 1 else ""
    return number, label


def parse_import(
    text: str,
    existing: set[str] | None = None,
) -> ImportResult:
    """Parse un bloc texte (collage ou contenu de fichier) en numéros normalisés.

    - existing : E.164 déjà présents (dédoublonnage vs base). Optionnel.
    - Dédoublonnage aussi à l'intérieur du lot.
    - Lignes vides ignorées silencieusement.
    """
    existing = existing or set()
    result = ImportResult()
    seen_in_batch: set[str] = set()

    for lineno, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        # Ignorer une éventuelle ligne d'en-tête CSV.
        low = stripped.lower()
        if lineno == 1 and re.search(r"num[eé]ro|number|tel|sda|msisdn", low) and not any(ch.isdigit() for ch in stripped):
            continue

        number_raw, label = _split_line(stripped)
        try:
            norm = normalize_number(number_raw)
        except ValueError as e:
            result.rejected.append({"raw": stripped, "reason": str(e)})
            continue

        e164 = norm["e164"]
        if e164 in existing or e164 in seen_in_batch:
            result.duplicates.append({"raw": stripped, "e164": e164})
            continue

        seen_in_batch.add(e164)
        result.valid.append({
            "raw": number_raw,
            "e164": e164,
            "national": norm["national"],
            "label": label,
        })

    return result
