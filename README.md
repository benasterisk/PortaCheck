# PortaCheck — number portability verifier (SDA / DID)

A **local** application to verify number portability for batches of DID numbers (SDA)
after a phone migration, by placing mobile calls driven over ADB from an Android phone,
with a human, audio-based verdict and a cross-operator comparison report.

The verdict stays **human**: you listen to the announcement in your headset and decide
OK (reaches the new infrastructure) or NOK (old infrastructure / failure). The
application automates everything else: sequential dialing, keyboard verdict entry,
session resume, and a cross report between the passes of the two operators.

The interface is available in **8 languages** (English, 中文, हिन्दी, Español, العربية,
Deutsch, Português, Français); it starts in your browser's language and falls back to
English.

## For end users — the standalone executable (no install)

For technicians who don't develop, build a **single self-contained `PortaCheck.exe`** that
bundles Python, all dependencies, the frontend, **and adb.exe**. The user just
double-clicks it — nothing to install (no Python, no Node, no ADB).

Build it once on a dev machine:

```powershell
.\build-exe.ps1
```

This produces `dist\PortaCheck.exe` (~20 MB). Hand **that single file** to the technician,
optionally with `TECHNICIAN-GUIDE.txt` (a one-page quick-start). On first run it starts the
server, opens the browser, and creates its data files (`portacheck.db`, `logs\`,
`config.json`) **next to the exe**. The bundled `adb.exe` is used automatically, so the
target PC needs nothing installed — only the Android phone in USB with **USB debugging
enabled**.

Prefer the packaged builds attached to the
[latest GitHub release](https://github.com/benasterisk/PortaCheck/releases/latest) if one is
available — the `PortaCheck.exe` there is ready to run.

## Getting started (developers)

Double-click **`Lancer-PortaCheck.bat`** in the project folder. The launcher checks the
environment, builds the frontend if needed, starts the server and opens
`http://localhost:8765` in your browser. Keep the terminal window open while you use the
app — closing it stops the server.

> On Windows, prefer the `.bat` launcher over running `start.ps1` directly: it handles the
> PowerShell execution policy and keeps the window open so errors stay visible.

Requirements:
- **Python 3.11+** and **Node.js** (only needed for the first frontend build).
- **ADB (platform-tools)** — path set in `config.json` (`adb_path`), default
  `C:\platform-tools\adb.exe`. If missing, download it from
  [developer.android.com/tools/releases/platform-tools](https://developer.android.com/tools/releases/platform-tools).
- An Android phone over USB, with **USB debugging enabled** and the PC authorized.
  (An iPhone cannot be driven this way — iOS has no ADB equivalent.)

The first launch creates the Python environment (`.venv`), installs dependencies and
builds the frontend. Subsequent launches are immediate.

### Development mode

`dev.ps1` starts the backend (hot reload) and the Vite frontend (HMR) in two windows,
proxying the API. Dev frontend on `http://localhost:5173`.

## Usage

1. **Campaign** — create a campaign (e.g. "Lyon site migration").
2. **Import** — load an **Excel (.xlsx)** or CSV/TXT file, or paste the numbers. The app
   detects the columns and lets you choose which one holds the number and which is the
   label; press **Preview** to check the counts, then **Import**. All file columns are
   kept and shown later during the pass. Files without a header row are supported.
3. **Pass** — pick the SIM (operator), confirm, and enter the cockpit.
4. **Cockpit** — fully keyboard-driven:
   - `Space` Dial · `O` OK · `N` NOK · `S` Skip · `R` Redial ·
     `C` Comment · `Esc` Hang up · `←` `→` Move between records.
   - Live call state (INACTIVE / RINGING / IN CALL) + call timer.
   - Free navigation to any record: go back to correct a verdict (replaces it), add a
     timestamped comment (appended), or re-call.
   - Frequent comments offered as clickable tiles and in a drop-down.
   - Optional auto mode (dials the next number automatically, must be armed explicitly).
   - STOP at any time; resume restarts at the first number without a verdict.
5. **Second pass** — run another pass with the other SIM (swap it, click "Refresh SIM
   inventory").
6. **Report** — cross-view per number with automatic classification:
   - OK + OK → **Conforme** (compliant)
   - OK / NOK mismatch → **⚠ Cross-operator routing suspected**
   - NOK + NOK → **✖ Port failed**
   - single pass → **Partial** · SKIP → **Not tested**
   - Filters + **CSV** and **XLSX** exports.

## Architecture

- **Backend**: Python, FastAPI + uvicorn (port 8765), SQLite (`portacheck.db`).
  - `adb_service.py` — subprocess wrapper around `adb.exe` (timeout, full log in
    `logs/adb.log`, ADB connection errors translated to clear messages).
  - `adb_parsers.py` — `dumpsys` parsing (tested on `samples/phase0/` fixtures).
  - `tabular_import.py` — xlsx/csv/tsv reading, column detection, mapping.
  - `phone_state.py` — state monitor pushed over WebSocket `/ws/state`.
  - `report.py` — classification + CSV/XLSX exports.
- **Frontend**: React 18 + Vite + Tailwind (dark theme, console-style), i18n (8 languages).
- **Packaging**: PyInstaller one-file exe (`build-exe.ps1`) bundling Python, deps, frontend
  build and adb.exe — for zero-install deployment to technicians.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests/ -v
```

92 tests: dumpsys parsers (on real captures), FR number normalization, report
classification, tabular import (column detection, header-less files), free navigation,
verdict correction, comment suggestions, ADB error classification, DB + report + exports
integration.

## Safety guarantees

- Never dials without an explicit action (unless auto mode is armed for the current pass).
- Minimum 1 s between hang-up and the next dial (default 2 s), enforced on the server too.
- An unreachable SIM never blocks the other one — single-SIM mode is fully supported.
- Every verdict is persisted immediately — nothing is lost on a crash or disconnection.
- **Everything is local**: no outbound network call, no number sent outside, no telemetry.

## Scope

Single-SIM operation is fully supported (see `device_profile.json`). For a full
cross-operator check, insert the second SIM and refresh the inventory for the second
pass. Audio (Bluetooth headset) is **out of scope**: the app only drives the dialing;
you handle the listening.

## Repository notes

- `device_profile.json` (device serial, produced by the Phase 0 pre-flight) is
  git-ignored; a masked `device_profile.example.json` is provided.
- `config.json` holds only paths/ports — never any secret.
