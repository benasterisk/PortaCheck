// In-app user guide (English). Installation + usage reference.

function Section({ title, children }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-lg font-semibold text-sky-400">{title}</h2>
      <div className="space-y-2 text-sm text-slate-300 leading-relaxed">{children}</div>
    </section>
  )
}

function Kbd({ children }) {
  return <span className="kbd mx-0.5">{children}</span>
}

function Step({ n, children }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-sky-600 text-white text-xs flex items-center justify-center font-semibold">
        {n}
      </span>
      <div className="flex-1 pt-0.5">{children}</div>
    </div>
  )
}

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">PortaCheck — User Guide</h1>
        <p className="text-slate-400 mt-1">
          A local tool to verify number portability (SDA / DID) after a migration, by placing
          test calls driven over ADB from an Android phone, with a human, audio-based verdict and
          a cross-operator comparison report.
        </p>
      </div>

      <Section title="What this tool does">
        <p>
          After a batch of numbers is ported, each one must be called from two different mobile
          networks (e.g. Orange and Free) to confirm it routes to the new infrastructure — a port
          can work operator-to-operator yet be mis-routed across operators.
        </p>
        <p>
          You listen to the announcement in your headset and decide <b>OK</b> (reaches the new
          infrastructure) or <b>NOK</b> (old infrastructure / failure). The application automates
          everything else: sequential dialing over ADB, keyboard verdict entry, session resume, and
          a comparative report between the passes of the two operators. The verdict stays human —
          the app never decides it for you.
        </p>
        <p className="text-slate-500">
          Audio (Bluetooth headset, "Link to Windows", etc.) is out of scope: the app only drives
          the dialing; you handle the listening.
        </p>
      </Section>

      <Section title="Requirements">
        <ul className="list-disc list-inside space-y-1">
          <li>A Windows 10/11 PC.</li>
          <li>An <b>Android phone</b> connected by USB, with <b>USB debugging enabled</b> and the
            PC authorized. (An iPhone cannot be driven this way — iOS has no ADB equivalent.)</li>
          <li><b>ADB / platform-tools</b> installed. Default path <code className="text-slate-400">C:\platform-tools\adb.exe</code>,
            configurable in <code className="text-slate-400">config.json</code>. If missing, download it from
            developer.android.com/tools/releases/platform-tools.</li>
          <li><b>Python 3.11+</b> and <b>Node.js</b> (only needed the first time, to build the app).</li>
        </ul>
        <p className="text-slate-500">
          One phone is enough. For a full check you need two SIMs (two operators) — insert one,
          run a pass, swap the SIM, run the second pass. The app is fully usable with a single SIM too.
        </p>
      </Section>

      <Section title="Installation & launch">
        <div className="space-y-3">
          <Step n="1">
            Double-click <b>Lancer-PortaCheck.bat</b> in the project folder. On the first run it
            creates the Python environment, installs dependencies, and builds the interface — this
            takes a minute. Subsequent launches are immediate.
          </Step>
          <Step n="2">
            A terminal window opens and shows <i>"Démarrage du serveur sur http://localhost:8765"</i>.
            <b> Leave this window open</b> while you use the app — closing it stops the server.
          </Step>
          <Step n="3">
            Your browser opens automatically at <code className="text-slate-400">http://localhost:8765</code>.
            If not, open that address manually.
          </Step>
        </div>
        <p className="text-slate-500 mt-2">
          Everything runs locally on your machine — no data ever leaves the PC, no external network
          calls, no telemetry.
        </p>
      </Section>

      <Section title="Step-by-step usage">
        <div className="space-y-3">
          <Step n="1">
            <b>Create a campaign</b> (e.g. "Site Lyon migration") on the Campaigns page.
          </Step>
          <Step n="2">
            <b>Import your numbers.</b> Load an <b>Excel (.xlsx)</b> or CSV/TXT file, or paste them.
            The app detects the columns and lets you choose which one holds the number and which is
            the label; press <b>Preview</b> to check the counts, then <b>Import</b>. All columns of
            the file are kept and shown later during the pass. Files with no header row are handled
            (columns are named "Colonne 1, 2, 3…").
          </Step>
          <Step n="3">
            <b>Start a pass.</b> Pick the SIM/operator (only reachable SIMs are offered; on a single
            SIM it is pre-selected), confirm, and enter the cockpit.
          </Step>
          <Step n="4">
            <b>Work the cockpit</b> (see the keyboard shortcuts below). Call the number, listen, give
            a verdict. All file columns are shown for context. Comments are timestamped and appended.
          </Step>
          <Step n="5">
            <b>Run the second pass</b> with the other SIM (insert it, click "Refresh SIM inventory"),
            then repeat.
          </Step>
          <Step n="6">
            <b>Open the report.</b> A cross-view per number with the automatic classification, filters,
            and CSV / XLSX export.
          </Step>
        </div>
      </Section>

      <Section title="The cockpit (call screen)">
        <p>The heart of the tool, designed to be driven entirely from the keyboard:</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          <div><Kbd>Space</Kbd> Dial the current number</div>
          <div><Kbd>Esc</Kbd> Hang up</div>
          <div><Kbd>O</Kbd> Verdict OK</div>
          <div><Kbd>N</Kbd> Verdict NOK</div>
          <div><Kbd>S</Kbd> Skip</div>
          <div><Kbd>R</Kbd> Redial</div>
          <div><Kbd>C</Kbd> Focus the comment field</div>
          <div><Kbd>←</Kbd> <Kbd>→</Kbd> Move between records</div>
        </div>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><b>Free navigation</b> — the ◄ ► arrows (and <Kbd>←</Kbd> <Kbd>→</Kbd>) move to any
            number in the file, not just the next untreated one. You can go back to correct a
            verdict, add a note, or re-call.</li>
          <li><b>Correction</b> — on an already-treated record, a new verdict replaces the old one,
            while the comment is appended (timestamped) so the history is preserved.</li>
          <li><b>Live call state</b> — INACTIVE / RINGING / IN CALL is shown from the phone, with a
            call timer.</li>
          <li><b>Frequent comments</b> — your past comments appear as clickable tiles and in a
            drop-down on the comment field, to standardize classification.</li>
          <li><b>Auto mode</b> (off by default) — after arming it explicitly, the next number is
            dialed automatically after the delay. In manual mode each dial needs <Kbd>Space</Kbd> or a click.</li>
          <li><b>STOP</b> pauses the pass cleanly; you can resume later — it restarts at the first
            number without a verdict. No verdict is ever lost.</li>
        </ul>
      </Section>

      <Section title="The comparison report">
        <p>Automatic classification per number, across the passes of the campaign:</p>
        <ul className="space-y-1">
          <li><span className="badge bg-emerald-900 text-emerald-300">Conforme</span> OK + OK — routes correctly on both operators.</li>
          <li><span className="badge bg-amber-900 text-amber-300">⚠ Routage inter-opérateurs suspect</span> OK on one, NOK on the other — the key case to watch.</li>
          <li><span className="badge bg-rose-900 text-rose-300">✖ Portage KO</span> NOK + NOK — the port failed.</li>
          <li><span className="badge bg-slate-700 text-slate-300">Partiel</span> only one pass done (single-SIM, or the second pass not run yet).</li>
          <li><span className="badge bg-slate-800 text-slate-500">Non testé</span> skipped on that pass.</li>
        </ul>
        <p>Filter by category / verdict / text, and export to <b>CSV</b> or <b>XLSX</b>. The report is
          coherent and usable even with a single pass.</p>
      </Section>

      <Section title="Troubleshooting">
        <ul className="list-disc list-inside space-y-1">
          <li><b>"Phone disconnected" banner</b> — check the USB cable and that USB debugging is
            authorized on the phone. If it persists, unplug/replug, or run <code className="text-slate-400">adb kill-server</code> then relaunch.</li>
          <li><b>No SIM shown</b> — wake/unlock the phone, then click "Refresh SIM inventory" on the
            SIM dashboard. A SIM that is removed simply won't appear (single-SIM mode is fine).</li>
          <li><b>The dialing screen stays hidden under the lock screen</b> — the phone has a secure
            lock. The app keeps the screen awake during a pass; unlock it once at the start of the pass.</li>
          <li><b>The launcher does nothing on double-click</b> — always use <b>Lancer-PortaCheck.bat</b>,
            not the .ps1 directly; the .bat handles the execution policy and keeps the window open.</li>
          <li><b>ADB command history</b> — the "Journal ADB" page lists recent ADB commands with return
            codes; the full log is in <code className="text-slate-400">logs/adb.log</code>.</li>
        </ul>
      </Section>

      <Section title="Safety guarantees">
        <ul className="list-disc list-inside space-y-1">
          <li>Never dials without an explicit action (unless auto mode is armed for the current pass).</li>
          <li>Minimum 1 s between hang-up and the next dial (default 2 s), enforced on the server too.</li>
          <li>An unreachable SIM never blocks the other one — single-SIM is fully supported.</li>
          <li>Every verdict is persisted immediately — nothing is lost on a crash or disconnection.</li>
          <li>Everything is local: no outbound network call, no number sent outside, no telemetry.</li>
        </ul>
      </Section>

      <p className="text-xs text-slate-600 text-center pt-2">
        PortaCheck — local application · your data never leaves this PC
      </p>
    </div>
  )
}
