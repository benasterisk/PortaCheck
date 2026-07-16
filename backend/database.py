"""Couche de persistance SQLite (stdlib sqlite3, aucune ORM).

Schéma conforme à CLAUDE.md §5. Persistance immédiate de chaque verdict
(garde-fou : aucune perte en cas de crash/déconnexion).

Thread-safety : chaque appel ouvre sa propre connexion (check_same_thread laissé
par défaut) — l'app est mono-utilisateur local, la charge est négligeable, et cela
évite tout partage de connexion entre le thread WebSocket et les handlers HTTP.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator

from config_loader import DB_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS campaigns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    notes       TEXT,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS numbers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    raw         TEXT NOT NULL,
    e164        TEXT NOT NULL,
    national    TEXT NOT NULL,
    label       TEXT,
    ord         INTEGER NOT NULL,
    extras      TEXT                                    -- JSON : toutes les colonnes du fichier importé
);

CREATE TABLE IF NOT EXISTS runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sim_subid    INTEGER,
    sim_operator TEXT,
    sim_slot     INTEGER,
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    status       TEXT NOT NULL DEFAULT 'en_cours'   -- en_cours | terminee | interrompue
);

CREATE TABLE IF NOT EXISTS calls (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    number_id  INTEGER NOT NULL REFERENCES numbers(id) ON DELETE CASCADE,
    attempt    INTEGER NOT NULL DEFAULT 1,
    dialed_at  TEXT,
    ended_at   TEXT,
    duration_s REAL,
    verdict    TEXT,                                  -- OK | NOK | SKIP | NULL
    comment    TEXT
);

-- Suggestions de commentaires, partagées sur toute l'app (enrichies aux verdicts).
CREATE TABLE IF NOT EXISTS comment_suggestions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    text      TEXT NOT NULL UNIQUE,
    count     INTEGER NOT NULL DEFAULT 1,
    last_used TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_numbers_campaign ON numbers(campaign_id, ord);
CREATE INDEX IF NOT EXISTS idx_calls_run ON calls(run_id);
CREATE INDEX IF NOT EXISTS idx_calls_number ON calls(number_id);
CREATE INDEX IF NOT EXISTS idx_runs_campaign ON runs(campaign_id);
"""


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)


def _migrate(conn: sqlite3.Connection) -> None:
    """Migrations légères pour les bases créées avant l'ajout de colonnes."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(numbers)").fetchall()}
    if "extras" not in cols:
        conn.execute("ALTER TABLE numbers ADD COLUMN extras TEXT")


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


# --- Campagnes ----------------------------------------------------------------

def create_campaign(name: str, notes: str = "") -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO campaigns (name, notes, created_at) VALUES (?, ?, ?)",
            (name, notes, now()),
        )
        return cur.lastrowid


def list_campaigns() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT c.*,
                   (SELECT COUNT(*) FROM numbers n WHERE n.campaign_id = c.id) AS number_count,
                   (SELECT COUNT(*) FROM runs r WHERE r.campaign_id = c.id) AS run_count
            FROM campaigns c ORDER BY c.id DESC
            """
        ).fetchall()
        return [dict(r) for r in rows]


def get_campaign(campaign_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
        return _row_to_dict(row)


def delete_campaign(campaign_id: int) -> None:
    with get_conn() as conn:
        conn.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,))


# --- Numéros ------------------------------------------------------------------

def add_numbers(campaign_id: int, numbers: list[dict[str, Any]]) -> int:
    """Insère une liste de numéros normalisés. numbers = [{raw,e164,national,label,extras?}].

    extras : dict des colonnes supplémentaires du fichier importé (stocké en JSON).
    L'ordre (ord) suit l'ordre de la liste, en repartant du max existant.
    Renvoie le nombre inséré.
    """
    if not numbers:
        return 0
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COALESCE(MAX(ord), -1) AS m FROM numbers WHERE campaign_id = ?",
            (campaign_id,),
        ).fetchone()
        start = (row["m"] or -1) + 1
        data = []
        for i, n in enumerate(numbers):
            extras = n.get("extras")
            extras_json = json.dumps(extras, ensure_ascii=False) if extras else None
            data.append((campaign_id, n["raw"], n["e164"], n["national"],
                         n.get("label", ""), start + i, extras_json))
        conn.executemany(
            "INSERT INTO numbers (campaign_id, raw, e164, national, label, ord, extras) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            data,
        )
        return len(data)


def _number_row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    """Convertit une ligne numbers en dict, en désérialisant extras (JSON → dict)."""
    d = dict(row)
    raw = d.get("extras")
    if raw:
        try:
            d["extras"] = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            d["extras"] = {}
    else:
        d["extras"] = {}
    return d


def list_numbers(campaign_id: int) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM numbers WHERE campaign_id = ? ORDER BY ord",
            (campaign_id,),
        ).fetchall()
        return [_number_row_to_dict(r) for r in rows]


def existing_e164(campaign_id: int) -> set[str]:
    """E.164 déjà présents dans la campagne (pour dédoublonnage à l'import)."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT e164 FROM numbers WHERE campaign_id = ?", (campaign_id,)
        ).fetchall()
        return {r["e164"] for r in rows}


# --- Passes (runs) ------------------------------------------------------------

def create_run(campaign_id: int, sim_subid: int | None, sim_operator: str | None, sim_slot: int | None) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO runs (campaign_id, sim_subid, sim_operator, sim_slot, started_at, status)
               VALUES (?, ?, ?, ?, ?, 'en_cours')""",
            (campaign_id, sim_subid, sim_operator, sim_slot, now()),
        )
        return cur.lastrowid


def get_run(run_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        return _row_to_dict(row)


def list_runs(campaign_id: int | None = None) -> list[dict[str, Any]]:
    with get_conn() as conn:
        if campaign_id is not None:
            rows = conn.execute(
                "SELECT * FROM runs WHERE campaign_id = ? ORDER BY id DESC", (campaign_id,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM runs ORDER BY id DESC").fetchall()
        return [dict(r) for r in rows]


def set_run_status(run_id: int, status: str, finished: bool = False) -> None:
    with get_conn() as conn:
        if finished:
            conn.execute(
                "UPDATE runs SET status = ?, finished_at = ? WHERE id = ?",
                (status, now(), run_id),
            )
        else:
            conn.execute("UPDATE runs SET status = ? WHERE id = ?", (status, run_id))


# --- Progression d'une passe / reprise ---------------------------------------

def run_progress(run_id: int) -> dict[str, Any]:
    """Compte total / traités / restants pour une passe."""
    run = get_run(run_id)
    if not run:
        return {"total": 0, "done": 0, "remaining": 0}
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) AS c FROM numbers WHERE campaign_id = ?", (run["campaign_id"],)
        ).fetchone()["c"]
        # COUNT(DISTINCT number_id) : un numéro re-composé (plusieurs calls) ne
        # compte qu'une fois, sinon 'done' pourrait dépasser 'total'.
        done = conn.execute(
            """SELECT COUNT(DISTINCT number_id) AS c FROM calls
               WHERE run_id = ? AND verdict IS NOT NULL""",
            (run_id,),
        ).fetchone()["c"]
    return {"total": total, "done": done, "remaining": total - done}


def next_pending_number(run_id: int, only_active: bool = True) -> dict[str, Any] | None:
    """Premier numéro de la campagne (ordre ord) SANS verdict pour cette passe.

    Reprise de session = ce numéro. Un numéro est « traité » dès qu'il a un
    call avec verdict non-NULL sur ce run.

    only_active : si True (défaut), une passe qui n'est plus « en_cours »
    (terminée/interrompue) renvoie None → l'UI la voit comme finie et aucune
    composition ne peut être relancée dessus. La reprise repasse le run en
    « en_cours » avant d'appeler cette fonction.
    """
    run = get_run(run_id)
    if not run:
        return None
    if only_active and run.get("status") != "en_cours":
        return None
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT n.* FROM numbers n
            WHERE n.campaign_id = ?
              AND n.id NOT IN (
                  SELECT c.number_id FROM calls c
                  WHERE c.run_id = ? AND c.verdict IS NOT NULL
              )
            ORDER BY n.ord
            LIMIT 1
            """,
            (run["campaign_id"], run_id),
        ).fetchone()
        return _number_row_to_dict(row) if row is not None else None


# --- Appels (calls) et verdicts ----------------------------------------------

def get_last_attempt(run_id: int, number_id: int) -> int:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT COALESCE(MAX(attempt), 0) AS m FROM calls WHERE run_id = ? AND number_id = ?",
            (run_id, number_id),
        ).fetchone()
        return row["m"] or 0


def record_dial(run_id: int, number_id: int, attempt: int) -> int:
    """Enregistre le début d'une tentative d'appel. Renvoie l'id du call."""
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO calls (run_id, number_id, attempt, dialed_at) VALUES (?, ?, ?, ?)",
            (run_id, number_id, attempt, now()),
        )
        return cur.lastrowid


def _stamp() -> str:
    """Horodatage court pour préfixer une note : [JJ/MM HH:MM]."""
    return datetime.now().strftime("[%d/%m %H:%M]")


def get_accumulated_comment(run_id: int, number_id: int) -> str:
    """Commentaire cumulé (multi-lignes horodatées) d'un numéro sur une passe.

    L'historique est porté par la dernière ligne de call qui a un commentaire
    (on écrit toujours l'historique complet sur la ligne mise à jour).
    """
    with get_conn() as conn:
        row = conn.execute(
            """SELECT comment FROM calls
               WHERE run_id = ? AND number_id = ? AND comment IS NOT NULL AND comment != ''
               ORDER BY attempt DESC, id DESC LIMIT 1""",
            (run_id, number_id),
        ).fetchone()
        return (row["comment"] if row else "") or ""


def record_verdict(
    run_id: int,
    number_id: int,
    verdict: str,
    comment: str = "",
    duration_s: float | None = None,
) -> int:
    """Enregistre un verdict sur la dernière tentative (ou en crée une).

    Persistance immédiate. Le verdict porte sur la dernière tentative (attempt max).
    Le commentaire, s'il est non vide, est AJOUTÉ à la suite de l'historique existant
    du numéro avec un horodatage ([JJ/MM HH:MM] texte), au lieu d'écraser.
    Renvoie l'id du call mis à jour/créé.
    """
    # Construire le commentaire cumulé.
    new_note = (comment or "").strip()
    history = get_accumulated_comment(run_id, number_id)
    if new_note:
        line = f"{_stamp()} {new_note}"
        full_comment = f"{history}\n{line}".strip() if history else line
        register_comment_suggestion(new_note)  # enrichir les suggestions partagées
    else:
        full_comment = history  # pas de nouvelle note : on conserve l'historique

    with get_conn() as conn:
        row = conn.execute(
            """SELECT id, attempt FROM calls
               WHERE run_id = ? AND number_id = ?
               ORDER BY attempt DESC LIMIT 1""",
            (run_id, number_id),
        ).fetchone()
        if row is not None:
            conn.execute(
                """UPDATE calls SET verdict = ?, comment = ?, ended_at = ?, duration_s = ?
                   WHERE id = ?""",
                (verdict, full_comment, now(), duration_s, row["id"]),
            )
            return row["id"]
        # Cas SKIP sans composition préalable : on crée un call directement.
        cur = conn.execute(
            """INSERT INTO calls (run_id, number_id, attempt, verdict, comment, ended_at, duration_s)
               VALUES (?, ?, 1, ?, ?, ?, ?)""",
            (run_id, number_id, verdict, full_comment, now(), duration_s),
        )
        return cur.lastrowid


def get_call_for(run_id: int, number_id: int) -> dict[str, Any] | None:
    """Call représentatif d'un numéro sur une passe (pour le rapport / la reprise).

    On privilégie la DERNIÈRE tentative AYANT un verdict. Sinon (aucun verdict
    encore), on renvoie la dernière tentative. Ainsi un « Recomposer » laissé sans
    verdict (call attempt=2 verdict=NULL) ne masque pas le verdict décisif de
    l'attempt=1 : le rapport garde le bon verdict.
    """
    with get_conn() as conn:
        row = conn.execute(
            """SELECT * FROM calls
               WHERE run_id = ? AND number_id = ? AND verdict IS NOT NULL
               ORDER BY attempt DESC LIMIT 1""",
            (run_id, number_id),
        ).fetchone()
        if row is None:
            row = conn.execute(
                """SELECT * FROM calls WHERE run_id = ? AND number_id = ?
                   ORDER BY attempt DESC LIMIT 1""",
                (run_id, number_id),
            ).fetchone()
        return _row_to_dict(row)


# --- Suggestions de commentaires (partagées) ----------------------------------

def register_comment_suggestion(text: str) -> None:
    """Enregistre/incrémente une suggestion de commentaire (upsert)."""
    text = (text or "").strip()
    if not text:
        return
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO comment_suggestions (text, count, last_used)
               VALUES (?, 1, ?)
               ON CONFLICT(text) DO UPDATE SET
                   count = count + 1,
                   last_used = excluded.last_used""",
            (text, now()),
        )


def list_comment_suggestions(limit: int = 50) -> list[dict[str, Any]]:
    """Suggestions triées par fréquence puis récence (les plus utiles en premier)."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT text, count, last_used FROM comment_suggestions
               ORDER BY count DESC, last_used DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


# --- Navigation libre dans une passe ------------------------------------------

def list_run_numbers(run_id: int) -> list[dict[str, Any]]:
    """Tous les numéros de la campagne du run, dans l'ordre, avec leur état.

    Chaque entrée : {index, id, national, e164, label, extras,
                     verdict, comment (cumulé), duration_s, attempts}.
    Permet la navigation ◄ ► sur n'importe quelle fiche.
    """
    run = get_run(run_id)
    if not run:
        return []
    numbers = list_numbers(run["campaign_id"])
    result: list[dict[str, Any]] = []
    with get_conn() as conn:
        for idx, num in enumerate(numbers):
            call = conn.execute(
                """SELECT verdict, comment, duration_s FROM calls
                   WHERE run_id = ? AND number_id = ? AND verdict IS NOT NULL
                   ORDER BY attempt DESC LIMIT 1""",
                (run_id, num["id"]),
            ).fetchone()
            attempts = conn.execute(
                "SELECT COUNT(*) AS c FROM calls WHERE run_id = ? AND number_id = ?",
                (run_id, num["id"]),
            ).fetchone()["c"]
            comment = get_accumulated_comment(run_id, num["id"])
            result.append({
                "index": idx,
                "id": num["id"],
                "national": num["national"],
                "e164": num["e164"],
                "label": num["label"] or "",
                "extras": num.get("extras", {}),
                "verdict": call["verdict"] if call else None,
                "comment": comment,
                "duration_s": call["duration_s"] if call else None,
                "attempts": attempts,
            })
    return result


def get_run_number_at(run_id: int, index: int) -> dict[str, Any] | None:
    """Fiche complète d'un numéro par son index (0-based) dans la passe."""
    items = list_run_numbers(run_id)
    if 0 <= index < len(items):
        return items[index]
    return None
