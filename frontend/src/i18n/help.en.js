// Structured Help content (English = source of truth).
// Rendered by HelpPage. Blocks: {type: 'p'|'note'|'ul'|'steps'|'shortcuts'|'legend'}.
// Inline emphasis uses **bold** and `code`; the renderer converts them.

export const helpEn = {
  title: 'PortaCheck — User Guide',
  intro:
    'A local tool to verify number portability (SDA / DID) after a migration, by placing test calls driven over ADB from an Android phone, with a human, audio-based verdict and a cross-operator comparison report.',
  sections: [
    {
      title: 'What this tool does',
      blocks: [
        { type: 'p', text: 'After a batch of numbers is ported, each one must be called from two different mobile networks (e.g. Orange and Free) to confirm it routes to the new infrastructure — a port can work operator-to-operator yet be mis-routed across operators.' },
        { type: 'p', text: 'You listen to the announcement in your headset and decide **OK** (reaches the new infrastructure) or **NOK** (old infrastructure / failure). The application automates everything else: sequential dialing over ADB, keyboard verdict entry, session resume, and a comparative report between the passes of the two operators. The verdict stays human — the app never decides it for you.' },
        { type: 'note', text: 'Audio (Bluetooth headset, "Link to Windows", etc.) is out of scope: the app only drives the dialing; you handle the listening.' },
      ],
    },
    {
      title: 'Requirements',
      blocks: [
        { type: 'ul', items: [
          'A Windows 10/11 PC.',
          'An **Android phone** connected by USB, with **USB debugging enabled** and the PC authorized. (An iPhone cannot be driven this way — iOS has no ADB equivalent.)',
          '**ADB / platform-tools** available. With the standalone `PortaCheck.exe`, adb is already bundled — nothing to install. Otherwise the default path is `C:\\platform-tools\\adb.exe`, configurable in `config.json`.',
          '**Python 3.11+** and **Node.js** — only for developers building from source, not for the packaged exe.',
        ] },
        { type: 'note', text: 'One phone is enough. For a full check you need two SIMs (two operators) — insert one, run a pass, swap the SIM, run the second pass. The app is fully usable with a single SIM too.' },
      ],
    },
    {
      title: 'Installation & launch',
      blocks: [
        { type: 'steps', items: [
          'The easiest way: double-click **PortaCheck.exe** — nothing to install (Python, dependencies, the interface and adb are all bundled).',
          'A console window opens (the server). **Leave it open** while you use the app — closing it stops the server.',
          'Your browser opens automatically at `http://localhost:8765`. If not, open that address manually.',
        ] },
        { type: 'note', text: 'Everything runs locally on your machine — no data ever leaves the PC, no external network calls, no telemetry.' },
      ],
    },
    {
      title: 'Step-by-step usage',
      blocks: [
        { type: 'steps', items: [
          '**Create a campaign** (e.g. "Site Lyon migration") on the Campaigns page.',
          '**Import your numbers.** Load an **Excel (.xlsx)** or CSV/TXT file, or paste them. The app detects the columns and lets you choose which one holds the number and which is the label; press **Preview** to check the counts, then **Import**. All columns of the file are kept and shown later during the pass. Files with no header row are handled.',
          '**Start a pass.** Pick the SIM/operator (only reachable SIMs are offered; on a single SIM it is pre-selected), confirm, and enter the cockpit.',
          '**Work the cockpit** (see the keyboard shortcuts below). Call the number, listen, give a verdict. All file columns are shown for context. Comments are timestamped and appended.',
          '**Run the second pass** with the other SIM (insert it, click "Refresh SIM inventory"), then repeat.',
          '**Open the report.** A cross-view per number with the automatic classification, filters, and CSV / XLSX export.',
        ] },
      ],
    },
    {
      title: 'The cockpit (call screen)',
      blocks: [
        { type: 'p', text: 'The heart of the tool, designed to be driven entirely from the keyboard:' },
        { type: 'shortcuts', items: [
          { keys: ['Space'], label: 'Dial the current number' },
          { keys: ['Esc'], label: 'Hang up' },
          { keys: ['O'], label: 'Verdict OK' },
          { keys: ['N'], label: 'Verdict NOK' },
          { keys: ['S'], label: 'Skip' },
          { keys: ['R'], label: 'Redial' },
          { keys: ['C'], label: 'Focus the comment field' },
          { keys: ['←', '→'], label: 'Move between records' },
        ] },
        { type: 'ul', items: [
          '**Free navigation** — the arrows move to any number in the file, not just the next untreated one. You can go back to correct a verdict, add a note, or re-call.',
          '**Correction** — on an already-treated record, a new verdict replaces the old one, while the comment is appended (timestamped) so the history is preserved.',
          '**Live call state** — INACTIVE / RINGING / IN CALL is shown from the phone, with a call timer.',
          '**Frequent comments** — your past comments appear as clickable tiles and in a drop-down on the comment field, to standardize classification.',
          '**Auto mode** (off by default) — after arming it explicitly, the next number is dialed automatically after the delay. In manual mode each dial needs Space or a click.',
          '**STOP** pauses the pass cleanly; you can resume later — it restarts at the first number without a verdict. No verdict is ever lost.',
          '**All numbers treated** — a green banner appears; click "Finish + report" to close the pass and open the report.',
        ] },
      ],
    },
    {
      title: 'The comparison report',
      blocks: [
        { type: 'p', text: 'Automatic classification per number, across the passes of the campaign:' },
        { type: 'legend', items: [
          { badge: 'emerald', title: 'Conforme', text: 'OK + OK — routes correctly on both operators.' },
          { badge: 'amber', title: '⚠ Cross-operator routing suspected', text: 'OK on one, NOK on the other — the key case to watch.' },
          { badge: 'rose', title: '✖ Port failed', text: 'NOK + NOK — the port failed.' },
          { badge: 'slate', title: 'Partial', text: 'only one pass done (single-SIM, or the second pass not run yet).' },
          { badge: 'slatedim', title: 'Not tested', text: 'skipped on that pass.' },
        ] },
        { type: 'p', text: 'Filter by category / verdict / text, and export to **CSV** or **XLSX**. The report is coherent and usable even with a single pass.' },
      ],
    },
    {
      title: 'Troubleshooting',
      blocks: [
        { type: 'ul', items: [
          '**"Phone disconnected" banner** — check the USB cable and that USB debugging is authorized on the phone. If it persists, unplug/replug, or run `adb kill-server` then relaunch.',
          '**No SIM shown** — wake/unlock the phone, then click "Refresh SIM inventory" on the SIM dashboard. A SIM that is removed simply won\'t appear (single-SIM mode is fine).',
          '**The dialing screen stays hidden under the lock screen** — the phone has a secure lock. The app keeps the screen awake during a pass; unlock it once at the start of the pass.',
          '**ADB command history** — the "ADB log" page lists recent ADB commands with return codes; the full log is in `logs/adb.log`.',
        ] },
      ],
    },
    {
      title: 'Safety guarantees',
      blocks: [
        { type: 'ul', items: [
          'Never dials without an explicit action (unless auto mode is armed for the current pass).',
          'Minimum 1 s between hang-up and the next dial (default 2 s), enforced on the server too.',
          'An unreachable SIM never blocks the other one — single-SIM is fully supported.',
          'Every verdict is persisted immediately — nothing is lost on a crash or disconnection.',
          'Everything is local: no outbound network call, no number sent outside, no telemetry.',
        ] },
      ],
    },
  ],
  footer: 'PortaCheck — local application · your data never leaves this PC',
}
