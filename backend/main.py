"""API FastAPI de PortaCheck — orchestration ADB, DB, passes, rapport.

Sert aussi le build de production du frontend en statique (frontend/dist).
WebSocket /ws/state : pousse l'état téléphone toutes les secondes.

Garde-fous appliqués ici :
  - Jamais de composition sans action utilisateur explicite (chaque /dial est un POST).
  - Délai minimal 1 s entre raccroché et composition (appliqué côté frontend + borne ici).
  - SIM injoignable non bloquante.
  - Persistance immédiate de chaque verdict.
  - Tout en local, aucun appel réseau externe.
"""
from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Body
from fastapi.responses import Response, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import adb_service as adb
import database as db
import report as report_mod
import tabular_import
from phone_numbers import parse_import
from phone_state import monitor
from config_loader import load_config, load_profile, save_profile, ROOT, FRONTEND_DIST

app = FastAPI(title="PortaCheck", version="1.0")


# --- Cycle de vie -------------------------------------------------------------

@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    monitor.start()


@app.on_event("shutdown")
def _shutdown() -> None:
    monitor.stop()


# --- Helpers -----------------------------------------------------------------

def _adb_guard(fn, *args, **kwargs):
    """Exécute une action ADB et convertit AdbError en HTTP 409 avec message FR."""
    try:
        return fn(*args, **kwargs)
    except adb.AdbError as e:
        raise HTTPException(status_code=409, detail={"error": e.message_fr, "kind": e.kind})


def state_call_active() -> bool:
    """État d'appel actif, lu en LIVE (dumpsys direct) pour éviter la latence du
    cache du monitor (poll jusqu'à 3 s au repos). Repli sur le cache en cas d'échec.
    """
    try:
        return adb.get_call_state() == 2
    except adb.AdbError:
        return bool(monitor.snapshot().get("call_active"))


# =============================================================================
# Profil & config
# =============================================================================

@app.get("/api/profile")
def get_profile() -> dict[str, Any]:
    profile = load_profile()
    config = load_config()
    return {"profile": profile, "config": config}


@app.get("/api/health")
def health() -> dict[str, Any]:
    """État global : ADB, appareil, profil."""
    state = monitor.snapshot()
    return {
        "device_connected": state["device_connected"],
        "device_state": state["device_state"],
        "has_profile": load_profile() is not None,
    }


# =============================================================================
# Campagnes
# =============================================================================

@app.get("/api/campaigns")
def campaigns() -> list[dict[str, Any]]:
    return db.list_campaigns()


@app.post("/api/campaigns")
def new_campaign(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Le nom de la campagne est requis.")
    cid = db.create_campaign(name, payload.get("notes", ""))
    return {"id": cid}


@app.get("/api/campaigns/{campaign_id}")
def campaign_detail(campaign_id: int) -> dict[str, Any]:
    c = db.get_campaign(campaign_id)
    if not c:
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    c["numbers"] = db.list_numbers(campaign_id)
    c["runs"] = db.list_runs(campaign_id)
    return c


@app.delete("/api/campaigns/{campaign_id}")
def remove_campaign(campaign_id: int) -> dict[str, Any]:
    db.delete_campaign(campaign_id)
    return {"ok": True}


# =============================================================================
# Import de numéros
# =============================================================================

@app.post("/api/campaigns/{campaign_id}/import/preview")
def import_preview(campaign_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Prévisualisation : parse le texte sans rien enregistrer.

    Dédoublonne aussi vis-à-vis des numéros déjà dans la campagne.
    """
    if not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    text = payload.get("text", "")
    existing = db.existing_e164(campaign_id)
    result = parse_import(text, existing=existing)
    return result.as_dict()


@app.post("/api/campaigns/{campaign_id}/import/commit")
def import_commit(campaign_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Enregistre les numéros valides (re-parse pour cohérence, dédoublonnage inclus)."""
    if not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    text = payload.get("text", "")
    existing = db.existing_e164(campaign_id)
    result = parse_import(text, existing=existing)
    added = db.add_numbers(campaign_id, result.valid)
    return {"added": added, **result.as_dict()}


# --- Import de fichier tabulaire (xlsx/csv/tsv) avec mapping de colonnes -------

def _decode_upload(payload: dict[str, Any]) -> tuple[str, bytes]:
    """Extrait (filename, bytes) d'un payload {filename, content_b64}."""
    import base64
    filename = payload.get("filename", "")
    b64 = payload.get("content_b64", "")
    try:
        data = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Fichier illisible (encodage base64 invalide).")
    if not data:
        raise HTTPException(status_code=400, detail="Fichier vide.")
    return filename, data


@app.post("/api/campaigns/{campaign_id}/import/analyze")
def import_analyze(campaign_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Analyse un fichier tabulaire uploadé : colonnes, échantillons, colonne devinée.

    payload : {filename, content_b64}
    Renvoie l'analyse + la grille (pour un commit ultérieur sans ré-upload).
    """
    if not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    filename, data = _decode_upload(payload)
    try:
        grid = tabular_import.read_file(filename, data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Impossible de lire le fichier : {e}")
    analysis = tabular_import.analyze(grid)
    return {"analysis": analysis, "grid": grid}


def _tabular_result(campaign_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    """Valide le mapping et calcule le résultat (valides/rejets/doublons), sans persister."""
    grid = payload.get("grid")
    if not grid:
        raise HTTPException(status_code=400, detail="Données de fichier manquantes.")
    number_col = payload.get("number_col")
    if number_col is None:
        raise HTTPException(status_code=400, detail="Choisissez la colonne qui contient le numéro à appeler.")
    try:
        number_col = int(number_col)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Colonne du numéro invalide.")
    header_row = payload.get("header_row", 0)
    label_col = payload.get("label_col")
    if label_col is not None:
        try:
            label_col = int(label_col)
        except (TypeError, ValueError):
            label_col = None
    existing = db.existing_e164(campaign_id)
    return tabular_import.build_numbers(grid, header_row, number_col, label_col, existing=existing)


@app.post("/api/campaigns/{campaign_id}/import/preview-tabular")
def import_preview_tabular(campaign_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Prévisualise l'import d'un fichier tabulaire selon le mapping, SANS enregistrer.

    payload : {grid, header_row, number_col, label_col?}
    """
    if not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    return _tabular_result(campaign_id, payload)


@app.post("/api/campaigns/{campaign_id}/import/commit-tabular")
def import_commit_tabular(campaign_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Enregistre les numéros d'un fichier tabulaire selon le mapping choisi.

    payload : {grid, header_row, number_col, label_col?}
    """
    if not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    result = _tabular_result(campaign_id, payload)
    added = db.add_numbers(campaign_id, result["valid"])
    return {"added": added, **result}


# =============================================================================
# Inventaire SIM
# =============================================================================

@app.get("/api/sims")
def get_sims() -> dict[str, Any]:
    state = monitor.snapshot()
    return {"sims": state["sims"], "sim_error": state["sim_error"],
            "device_connected": state["device_connected"]}


@app.post("/api/sims/refresh")
def refresh_sims() -> dict[str, Any]:
    cards = monitor.refresh_sim_inventory()
    state = monitor.snapshot()
    return {"sims": cards, "sim_error": state["sim_error"]}


# =============================================================================
# Passes (runs)
# =============================================================================

@app.post("/api/runs")
def create_run(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Démarre une passe. Applique la bascule SIM selon la méthode du profil.

    payload : {campaign_id, sim_subid, sim_operator, sim_slot}
    Renvoie : {run_id, switch: {method, ok, message}, keep_screen_on}
    """
    campaign_id = payload.get("campaign_id")
    if not campaign_id or not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    if not db.list_numbers(campaign_id):
        raise HTTPException(status_code=400, detail="Aucun numéro dans la campagne : importez d'abord un listing.")

    sim_subid = payload.get("sim_subid")
    sim_operator = payload.get("sim_operator")
    sim_slot = payload.get("sim_slot")

    profile = load_profile() or {}
    method = profile.get("sim_switch_method", "manual")
    switch_result = _apply_sim_switch(method, sim_subid, sim_operator)

    # Maintien de l'écran allumé si requis par le profil.
    keep_on = bool(profile.get("keep_screen_on_during_run"))
    if keep_on:
        try:
            adb.wakeup()
            adb.stay_on(True)
        except adb.AdbError:
            pass  # non bloquant

    run_id = db.create_run(campaign_id, sim_subid, sim_operator, sim_slot)
    return {"run_id": run_id, "switch": switch_result, "keep_screen_on": keep_on}


def _apply_sim_switch(method: str, sim_subid: Any, sim_operator: str | None) -> dict[str, Any]:
    """Applique la bascule SIM. Ne bloque JAMAIS : repli 'manual' si échec."""
    if method == "A" and sim_subid is not None:
        try:
            read_back = adb.set_voice_subid(sim_subid)
            ok = str(read_back).strip() == str(sim_subid).strip()
            if ok:
                return {"method": "A", "ok": True,
                        "message": f"SIM d'appel par défaut réglée sur {sim_operator} (subId {sim_subid})."}
            # Relecture non conforme → repli manual.
            return {"method": "manual", "ok": False,
                    "message": (f"Bascule automatique non confirmée. Basculez manuellement la SIM d'appel "
                                f"par défaut sur {sim_operator} (Paramètres > Gestionnaire SIM > Appels), "
                                f"puis confirmez.")}
        except adb.AdbError as e:
            return {"method": "manual", "ok": False,
                    "message": (f"{e.message_fr} Basculez manuellement la SIM d'appel sur {sim_operator} "
                                f"(Paramètres > Gestionnaire SIM > Appels), puis confirmez.")}
    if method == "B":
        return {"method": "B", "ok": True,
                "message": "Le choix de SIM se fera à chaque composition (méthode B)."}
    # manual (ou mono-SIM sans bascule nécessaire)
    return {"method": "manual", "ok": True,
            "message": (f"Vérifiez que la SIM d'appel par défaut est bien {sim_operator} "
                        f"(Paramètres > Gestionnaire SIM > Appels).") if sim_operator else "SIM unique."}


@app.get("/api/runs")
def list_all_runs() -> list[dict[str, Any]]:
    return db.list_runs()


@app.get("/api/runs/{run_id}")
def run_detail(run_id: int, resume: bool = False) -> dict[str, Any]:
    """Détail d'une passe. resume=true réactive une passe 'interrompue' (reprise).

    Sans resume, une passe 'interrompue'/'terminee' est vue comme finie (current=None),
    ce qui empêche toute composition résiduelle (ex. timer frontend after STOP).
    Ouvrir explicitement une passe interrompue pour la continuer passe resume=true,
    ce qui la remet en 'en_cours' s'il reste des numéros à traiter.
    """
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Passe introuvable.")

    if resume and run["status"] == "interrompue":
        # Ne reprendre que s'il reste effectivement des numéros sans verdict.
        if db.next_pending_number(run_id, only_active=False) is not None:
            db.set_run_status(run_id, "en_cours")
            run = db.get_run(run_id)

    progress = db.run_progress(run_id)
    current = db.next_pending_number(run_id)  # None si run non 'en_cours'
    campaign = db.get_campaign(run["campaign_id"])
    # Enrichir le numéro courant : dernier call (reprise/recompose) + historique
    # de commentaire cumulé (multi-lignes horodatées).
    current_call = None
    comment_history = ""
    if current:
        current_call = db.get_call_for(run_id, current["id"])
        comment_history = db.get_accumulated_comment(run_id, current["id"])
    return {
        "run": run,
        "campaign": campaign,
        "progress": progress,
        "current": current,          # inclut current["extras"] (toutes les colonnes)
        "current_call": current_call,
        "comment_history": comment_history,
        "finished": current is None,
    }


@app.get("/api/runs/{run_id}/numbers")
def run_numbers(run_id: int) -> dict[str, Any]:
    """Liste ordonnée de tous les numéros de la passe avec leur état.

    Sert la navigation ◄ ► dans le cockpit (aller sur n'importe quelle fiche).
    """
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Passe introuvable.")
    items = db.list_run_numbers(run_id)
    progress = db.run_progress(run_id)
    # Index du premier numéro sans verdict (pour se positionner au bon endroit).
    first_pending = next((it["index"] for it in items if it["verdict"] is None), None)
    return {"run": run, "numbers": items, "progress": progress, "first_pending": first_pending}


@app.get("/api/runs/{run_id}/at/{index}")
def run_number_at(run_id: int, index: int) -> dict[str, Any]:
    """Fiche complète d'un numéro par son index (navigation)."""
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Passe introuvable.")
    item = db.get_run_number_at(run_id, index)
    if item is None:
        raise HTTPException(status_code=404, detail="Index hors limites.")
    total = db.run_progress(run_id)["total"]
    return {"number": item, "index": index, "total": total,
            "has_prev": index > 0, "has_next": index < total - 1}


@app.get("/api/comment-suggestions")
def comment_suggestions(limit: int = 50) -> dict[str, Any]:
    """Suggestions de commentaires (partagées), triées par fréquence/récence."""
    return {"suggestions": db.list_comment_suggestions(limit)}


@app.post("/api/runs/{run_id}/stop")
def stop_run(run_id: int) -> dict[str, Any]:
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Passe introuvable.")
    db.set_run_status(run_id, "interrompue")
    _end_of_run_cleanup()
    return {"ok": True, "status": "interrompue"}


@app.post("/api/runs/{run_id}/finish")
def finish_run(run_id: int) -> dict[str, Any]:
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Passe introuvable.")
    db.set_run_status(run_id, "terminee", finished=True)
    _end_of_run_cleanup()
    return {"ok": True, "status": "terminee"}


def _end_of_run_cleanup() -> None:
    """Fin de passe : relâcher le maintien d'écran si activé."""
    profile = load_profile() or {}
    if profile.get("keep_screen_on_during_run"):
        try:
            adb.stay_on(False)
        except adb.AdbError:
            pass


# =============================================================================
# Actions d'appel (cockpit)
# =============================================================================

# Horodatage (monotone) du dernier raccroché, pour borner le délai avant la
# composition suivante côté serveur (garde-fou §8.2, en plus du frontend).
_last_hangup_at: dict[int, float] = {}


@app.post("/api/runs/{run_id}/dial")
def dial_number(run_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Compose un numéro. Action utilisateur explicite (garde-fou).

    payload : {number_id, recompose?: bool}
    Détermine le format (+33/0) selon dial_format du profil.
    Enregistre la tentative (attempt) immédiatement.

    Garde-fous serveur (ne reposent pas que sur le frontend) :
      - la passe doit être 'en_cours' (sinon 409) → pas de composition après STOP ;
      - délai minimal dial_delay_min_s depuis le dernier raccroché (sinon 429) ;
      - si un appel est déjà actif, on le raccroche d'abord.
    """
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Passe introuvable.")
    if run["status"] != "en_cours":
        raise HTTPException(status_code=409, detail={
            "error": "La passe n'est pas en cours : composition refusée.",
            "kind": "run_not_active",
        })
    number_id = payload.get("number_id")
    numbers = {n["id"]: n for n in db.list_numbers(run["campaign_id"])}
    num = numbers.get(number_id)
    if not num:
        raise HTTPException(status_code=404, detail="Numéro introuvable dans la campagne.")

    # Borne serveur du délai minimal entre raccroché et composition.
    cfg = load_config()
    min_delay = float(cfg.get("dial_delay_min_s", 1))
    last_hang = _last_hangup_at.get(run_id)
    if last_hang is not None:
        elapsed = time.monotonic() - last_hang
        if elapsed < min_delay:
            raise HTTPException(status_code=429, detail={
                "error": f"Délai minimal de {min_delay:g}s non respecté depuis le raccroché.",
                "kind": "too_soon",
            })

    # Si un appel est encore actif, raccrocher d'abord (évite la superposition).
    state = monitor.snapshot()
    if state.get("call_active"):
        try:
            adb.hangup()
        except adb.AdbError:
            pass

    profile = load_profile() or {}
    dial_format = profile.get("dial_format", "e164")
    to_dial = num["e164"] if dial_format == "e164" else num["national"]

    # Réveil écran avant composition (utile si l'écran s'est éteint).
    if profile.get("keep_screen_on_during_run"):
        try:
            adb.wakeup()
        except adb.AdbError:
            pass

    attempt = db.get_last_attempt(run_id, number_id) + 1
    _adb_guard(adb.dial, to_dial)
    db.record_dial(run_id, number_id, attempt)
    return {"ok": True, "dialed": to_dial, "attempt": attempt}


@app.post("/api/runs/{run_id}/hangup")
def hangup_call(run_id: int) -> dict[str, Any]:
    _adb_guard(adb.hangup)
    _last_hangup_at[run_id] = time.monotonic()
    return {"ok": True}


@app.post("/api/runs/{run_id}/verdict")
def record_verdict(run_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Enregistre un verdict (OK/NOK/SKIP). Raccroche d'abord si l'appel est actif.

    payload : {number_id, verdict, comment?, duration_s?}
    Persistance immédiate. Renvoie le prochain numéro à traiter (ou fin).
    """
    run = db.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Passe introuvable.")
    number_id = payload.get("number_id")
    verdict = payload.get("verdict")
    if verdict not in ("OK", "NOK", "SKIP"):
        raise HTTPException(status_code=400, detail="Verdict invalide (OK, NOK ou SKIP attendu).")

    # Raccrocher si un appel est encore actif (best effort, non bloquant).
    # On lit l'état live (pas seulement le cache, qui peut être en retard de
    # quelques secondes) pour ne pas laisser un appel décroché avant d'avancer.
    call_active = state_call_active()
    if call_active:
        try:
            adb.hangup()
        except adb.AdbError:
            pass
    # Mémoriser le raccroché pour la borne de délai serveur, même si l'appel
    # n'était pas détecté actif (le numéro suivant respectera le délai min).
    _last_hangup_at[run_id] = time.monotonic()

    comment = payload.get("comment", "") or ""
    duration_s = payload.get("duration_s")
    db.record_verdict(run_id, number_id, verdict, comment, duration_s)

    progress = db.run_progress(run_id)
    nxt = db.next_pending_number(run_id)
    finished = nxt is None
    if finished:
        db.set_run_status(run_id, "terminee", finished=True)
        _end_of_run_cleanup()
    return {"ok": True, "progress": progress, "next": nxt, "finished": finished}


# =============================================================================
# Rapport & exports
# =============================================================================

@app.get("/api/campaigns/{campaign_id}/report")
def get_report(campaign_id: int) -> dict[str, Any]:
    if not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    return report_mod.build_report(campaign_id)


@app.get("/api/campaigns/{campaign_id}/export/csv")
def export_csv_route(campaign_id: int):
    if not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    name, content = report_mod.export_csv(campaign_id)
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@app.get("/api/campaigns/{campaign_id}/export/xlsx")
def export_xlsx_route(campaign_id: int):
    if not db.get_campaign(campaign_id):
        raise HTTPException(status_code=404, detail="Campagne introuvable.")
    name, content = report_mod.export_xlsx(campaign_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# =============================================================================
# Journal ADB
# =============================================================================

@app.get("/api/logs")
def get_logs(limit: int = 200) -> dict[str, Any]:
    return {"logs": adb.get_recent_logs(limit)}


# =============================================================================
# WebSocket état téléphone
# =============================================================================

@app.websocket("/ws/state")
async def ws_state(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            snapshot = monitor.snapshot()
            await websocket.send_text(json.dumps(snapshot))
            # Cadence : 1 s pendant appel, sinon on suit l'intervalle de repos.
            interval = 1.0 if snapshot.get("call_active") else 1.0
            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        return
    except Exception:
        # Fermeture silencieuse si le client part.
        return


# =============================================================================
# Frontend statique (build de production)
# =============================================================================

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # Ne pas intercepter les routes API/WS.
        if full_path.startswith("api/") or full_path.startswith("ws/"):
            raise HTTPException(status_code=404)
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        index = FRONTEND_DIST / "index.html"
        if index.exists():
            return FileResponse(index)
        raise HTTPException(status_code=404, detail="Frontend non build. Lancez 'npm run build' dans frontend/.")
else:
    @app.get("/")
    def no_frontend():
        return JSONResponse({
            "message": "PortaCheck backend actif. Le frontend n'est pas encore build.",
            "hint": "cd frontend && npm install && npm run build, ou utilisez dev.ps1 pour le mode dev.",
        })
