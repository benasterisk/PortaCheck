"""Parsing des sorties dumpsys — module isolé et testé sur fixtures.

Le parsing de dumpsys est fragile (format non documenté, variable selon les ROM).
On le garde ici, sans I/O, pour le tester unitairement sur les captures réelles
de samples/phase0/.

Deux entrées :
  - parse_isub(text)      → inventaire SIM depuis `dumpsys isub`
  - parse_telephony(text) → état réseau par phoneId + mCallState depuis
                            `dumpsys telephony.registry`
  - parse_call_state(text) → juste le mCallState global (raccourci)

Robustesse encodage : les fixtures capturées par PowerShell sont en UTF-16
(octets nuls intercalés). On normalise l'entrée pour que le même code fonctionne
sur la fixture et sur le flux live UTF-8.
"""
from __future__ import annotations

import re
from typing import Any


# --- Normalisation d'entrée ---------------------------------------------------

def _normalize(text: str) -> str:
    """Supprime les octets nuls (résidus UTF-16 lus en latin-1/utf-8) et le BOM.

    Sur le flux live UTF-8, cette fonction est un quasi no-op.
    """
    if text is None:
        return ""
    # Retire NUL et BOM éventuels.
    text = text.replace("\x00", "").lstrip("﻿")
    return text


# --- dumpsys isub -------------------------------------------------------------

_RE_SIM_STATE = re.compile(r"mSimState\[(\d+)\]=(\w+)")
_RE_LOGICAL_MAP = re.compile(r"Logical SIM slot (\d+):\s*subId=(-?\d+)")
_RE_DEFAULT_VOICE = re.compile(r"defaultVoiceSubId=(-?\d+)")
_RE_ICCID_SLOT = re.compile(r"slot (\d+):\s*(\S+)?")


def _extract_kv(segment: str, key: str) -> str | None:
    """Extrait `key=valeur` dans un segment de SubscriptionInfoInternal.

    La valeur s'arrête au prochain ` <mot>=` (clé suivante). Gère les valeurs
    contenant des espaces (ex. carrierName=Aucun service).
    """
    m = re.search(rf"\b{re.escape(key)}=(.*?)(?=\s+[A-Za-z_][A-Za-z0-9_]*=|\s*\]$|$)", segment)
    if not m:
        return None
    return m.group(1).strip()


def _split_subscription_blocks(text: str) -> list[str]:
    """Découpe les blocs [SubscriptionInfoInternal: … ] (peuvent contenir des ]).

    On repère chaque début de bloc et on prend jusqu'au prochain début ou fin.
    """
    blocks: list[str] = []
    starts = [m.start() for m in re.finditer(r"\[SubscriptionInfoInternal:", text)]
    for i, s in enumerate(starts):
        end = starts[i + 1] if i + 1 < len(starts) else len(text)
        blocks.append(text[s:end])
    return blocks


def parse_isub(text: str) -> dict[str, Any]:
    """Parse `dumpsys isub`. Renvoie l'inventaire des SIM actives.

    Structure renvoyée :
    {
      "default_voice_subid": int | None,
      "sim_states": {0: "ABSENT", 1: "LOADED", ...},
      "sims": [
        {"sub_id": 1, "slot_index": 1, "carrier_name": "Orange F",
         "display_name": "Orange F", "mcc": "208", "mnc": "01"}
      ],
      "active_count": 1
    }

    Ne retient QUE les subscriptions actives : celles présentes dans la section
    « Active subscriptions » ET dont simSlotIndex >= 0. Les subs à slotIndex=-1
    (SIM connues mais non insérées) sont ignorées.
    """
    text = _normalize(text)

    # États des slots physiques.
    sim_states: dict[int, str] = {}
    for m in _RE_SIM_STATE.finditer(text):
        sim_states[int(m.group(1))] = m.group(2)

    # SIM d'appel par défaut.
    default_voice = None
    mv = _RE_DEFAULT_VOICE.search(text)
    if mv:
        default_voice = int(mv.group(1))

    # On isole la section "Active subscriptions" (jusqu'à "All subscriptions"
    # ou "Embedded subscriptions").
    active_section = text
    m_active = re.search(r"Active subscriptions:", text)
    if m_active:
        rest = text[m_active.end():]
        # Fin de section = prochaine section connue.
        m_end = re.search(r"\n\s*(All subscriptions:|Embedded subscriptions:|Opportunistic subscriptions:|getAvailableSubscriptionInfoList)", rest)
        active_section = rest[: m_end.start()] if m_end else rest

    sims: list[dict[str, Any]] = []
    for block in _split_subscription_blocks(active_section):
        sub_id = _extract_kv(block, "id")
        slot_index = _extract_kv(block, "simSlotIndex")
        if sub_id is None:
            continue
        try:
            slot_i = int(slot_index) if slot_index is not None else -1
        except ValueError:
            slot_i = -1
        # Une SIM active insérée a slotIndex >= 0.
        if slot_i < 0:
            continue
        carrier = _extract_kv(block, "carrierName") or ""
        display = _extract_kv(block, "displayName") or carrier
        mcc = _extract_kv(block, "mcc")
        mnc = _extract_kv(block, "mnc")
        try:
            sid = int(sub_id)
        except ValueError:
            continue
        sims.append({
            "sub_id": sid,
            "slot_index": slot_i,
            "carrier_name": carrier,
            "display_name": display,
            "mcc": mcc,
            "mnc": mnc,
        })

    return {
        "default_voice_subid": default_voice,
        "sim_states": sim_states,
        "sims": sims,
        "active_count": len(sims),
    }


# --- dumpsys telephony.registry ----------------------------------------------

_RE_PHONE_ID = re.compile(r"Phone Id=(\d+)")
_RE_CALL_STATE = re.compile(r"mCallState=(-?\d+)")
_RE_VOICE_REG = re.compile(r"mVoiceRegState=(-?\d+)\((\w+)\)")
_RE_OPERATOR = re.compile(r"mOperatorAlphaLong=([^,}]*)")
_RE_SUBID = re.compile(r"\bsubId=(-?\d+)")
# Fin de la section de tête « last known state » : on s'arrête au premier
# marqueur de section suivante pour ne pas déborder dans « local logs: » etc.
_RE_HEAD_END = re.compile(r"\n\s*(local logs:|Local logs:|Phone state:|mPreferredDataPhoneId|Loggable|SubscriptionInfo)")


def _extract_service_state_block(segment: str) -> str:
    """Isole le contenu de mServiceState={...} (accolades équilibrées).

    Renvoie '' si absent ou null. Cela borne la recherche de voice_reg/operator
    au bloc de la bonne SIM, sans déborder sur des sections ultérieures.
    """
    key = "mServiceState={"
    idx = segment.find(key)
    if idx == -1:
        return ""
    i = idx + len(key)
    depth = 1
    start = i
    while i < len(segment) and depth > 0:
        c = segment[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        i += 1
    if depth != 0:
        return segment[start:]  # bloc non fermé : on prend ce qu'on a
    return segment[start:i - 1]


def parse_telephony(text: str) -> dict[str, Any]:
    """Parse `dumpsys telephony.registry`. Renvoie l'état par phoneId.

    Structure :
    {
      "phones": [
        {"phone_id": 0, "sub_id": <int|None>, "call_state": 0, "voice_reg_state": 1,
         "voice_reg_label": "OUT_OF_SERVICE", "in_service": False, "operator": ""},
        ...
      ],
      "call_state": 0   # max global
    }

    Le bloc de tête « last known state » liste chaque Phone Id avec son mCallState
    puis son mServiceState. On segmente par « Phone Id= » et on borne chaque
    segment : (a) à la section de tête (pas de débordement dans « local logs: »),
    (b) pour l'état réseau, au bloc mServiceState={...} de CE phone uniquement —
    sinon le dernier phoneId lirait la première valeur trouvée dans tout le tail.
    """
    text = _normalize(text)

    # Borner à la section de tête « last known state » si le marqueur de fin existe.
    head_end = _RE_HEAD_END.search(text)
    head = text[: head_end.start()] if head_end else text

    phones: list[dict[str, Any]] = []
    matches = list(_RE_PHONE_ID.finditer(head))
    seen: set[int] = set()
    for i, m in enumerate(matches):
        pid = int(m.group(1))
        if pid in seen:
            continue
        seen.add(pid)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(head)
        segment = head[start:end]

        cs = _RE_CALL_STATE.search(segment)
        call_state = int(cs.group(1)) if cs else 0

        sub_m = _RE_SUBID.search(segment)
        sub_id = int(sub_m.group(1)) if sub_m else None

        # État réseau : borné au bloc mServiceState de CE phone.
        svc = _extract_service_state_block(segment)
        vr = _RE_VOICE_REG.search(svc) if svc else None
        if vr:
            voice_reg = int(vr.group(1))
            voice_label = vr.group(2)
        else:
            voice_reg = -1
            voice_label = "UNKNOWN"

        op_m = _RE_OPERATOR.search(svc) if svc else None
        operator = op_m.group(1).strip() if op_m else ""

        phones.append({
            "phone_id": pid,
            "sub_id": sub_id,
            "call_state": call_state,
            "voice_reg_state": voice_reg,
            "voice_reg_label": voice_label,
            "in_service": (voice_reg == 0),
            "operator": operator,
        })

    global_call_state = max((p["call_state"] for p in phones), default=0)
    return {"phones": phones, "call_state": global_call_state}


def parse_call_state(text: str) -> int:
    """Raccourci : mCallState global (max sur les phoneId). 0=IDLE,1=RINGING,2=OFFHOOK."""
    return parse_telephony(text)["call_state"]


# --- Corrélation isub + telephony --------------------------------------------

def build_sim_status(isub_text: str, telephony_text: str, profile: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Croise l'inventaire SIM et l'état réseau pour l'affichage du dashboard.

    Renvoie une carte par SIM active :
    {sub_id, slot_index, operator, in_service, reachable, service_label}

    Le rattachement SIM ↔ état réseau se fait par **subId** (source autoritative :
    chaque bloc Phone Id de telephony.registry expose son subId). On ne suppose PAS
    phoneId == slotIndex (faux sur eSIM / slots remappés). Repli sur l'égalité
    phoneId == slotIndex uniquement si aucun subId n'est disponible.
    """
    isub = parse_isub(isub_text)
    tel = parse_telephony(telephony_text)
    phones_by_id = {p["phone_id"]: p for p in tel["phones"]}
    phones_by_subid = {p["sub_id"]: p for p in tel["phones"] if p.get("sub_id") is not None}

    cards: list[dict[str, Any]] = []
    for sim in isub["sims"]:
        slot = sim["slot_index"]
        # 1) Match autoritatif par subId. 2) Repli sur phoneId == slotIndex.
        phone = phones_by_subid.get(sim["sub_id"])
        if phone is None:
            phone = phones_by_id.get(slot)
        in_service = bool(phone and phone["in_service"])
        if phone is None:
            service_label = "INCONNU"
        elif in_service:
            service_label = "EN SERVICE"
        else:
            service_label = "HORS SERVICE"
        # Nom d'opérateur : préférer celui de la SIM ; compléter par le réseau.
        operator = sim["carrier_name"] or (phone["operator"] if phone else "")
        cards.append({
            "sub_id": sim["sub_id"],
            "slot_index": slot,
            "operator": operator,
            "in_service": in_service,
            "reachable": in_service,
            "service_label": service_label,
        })
    return cards
