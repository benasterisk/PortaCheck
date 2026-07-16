import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import SimCard from '../components/SimCard.jsx'
import { useT } from '../i18n/index.jsx'

function ResultSummary({ result }) {
  const t = useT()
  if (!result) return null
  return (
    <div className="border border-edge rounded p-3 space-y-2 text-sm">
      <div className="flex gap-4">
        <span className="text-emerald-400">{t('import.valid', { n: result.counts.valid })}</span>
        <span className="text-amber-400">{t('import.duplicates', { n: result.counts.duplicates })}</span>
        <span className="text-rose-400">{t('import.rejected', { n: result.counts.rejected })}</span>
      </div>
      {result.rejected.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-rose-400">{t('import.see_rejected')}</summary>
          <ul className="mt-1 space-y-0.5 max-h-40 overflow-auto">
            {result.rejected.map((r, i) => (
              <li key={i} className="text-slate-400">
                <span className="text-slate-200">{r.raw}</span> — {r.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
      {result.duplicates.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-amber-400">{t('import.see_duplicates')}</summary>
          <ul className="mt-1 space-y-0.5 max-h-40 overflow-auto">
            {result.duplicates.map((d, i) => (
              <li key={i} className="text-slate-400">
                {d.raw} → {d.e164}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

// Import par fichier tabulaire (xlsx/csv/tsv) : upload → mapping colonnes → commit.
function FileImport({ campaignId, onImported, onCancel, filename, analysis, grid }) {
  const t = useT()
  const columns = analysis.columns
  // État en STRING (les <select> HTML travaillent en chaînes). '' = « aucun ».
  const [numberCol, setNumberCol] = useState(
    analysis.number_col_guess != null ? String(analysis.number_col_guess) : ''
  )
  const [labelCol, setLabelCol] = useState(
    analysis.label_col_guess != null ? String(analysis.label_col_guess) : ''
  )
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const numberIdx = numberCol === '' ? null : Number(numberCol)
  const labelIdx = labelCol === '' ? null : Number(labelCol)
  const numberValid = numberIdx != null && !Number.isNaN(numberIdx)

  function buildPayload() {
    return {
      grid,
      header_row: analysis.header_row,
      number_col: numberIdx,
      label_col: labelIdx,
    }
  }

  async function doPreview() {
    if (!numberValid) return
    setBusy(true)
    setError(null)
    try {
      setPreview(await api.importPreviewTabular(campaignId, buildPayload()))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    if (!numberValid) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.importCommitTabular(campaignId, buildPayload())
      onImported(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-300">
        {t('import.file_info', { name: filename, rows: analysis.data_row_count, cols: columns.length })}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400">{t('import.number_col')}</label>
          <select
            className="input mt-1"
            value={numberCol}
            onChange={(e) => {
              setNumberCol(e.target.value)
              setPreview(null)
            }}
          >
            {columns.map((c) => (
              <option key={c.index} value={String(c.index)}>
                {c.name}
                {c.number_score >= 0.5 ? ` — ${t('import.pct_numbers', { pct: Math.round(c.number_score * 100) })}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400">{t('import.label_col')}</label>
          <select
            className="input mt-1"
            value={labelCol}
            onChange={(e) => {
              setLabelCol(e.target.value)
              setPreview(null)
            }}
          >
            <option value="">{t('import.none')}</option>
            {columns.map((c) => (
              <option key={c.index} value={String(c.index)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!numberValid && (
        <div className="text-amber-400 text-sm">
          {t('import.pick_number_col')}
        </div>
      )}

      {/* Aperçu des colonnes détectées */}
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-400">{t('import.preview_columns')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="text-left">
                <th className="pr-2">{t('import.col_header')}</th>
                <th>{t('import.samples')}</th>
              </tr>
            </thead>
            <tbody>
              {columns.map((c) => (
                <tr key={c.index} className="border-t border-edge/40">
                  <td className="pr-2 py-1 text-slate-300 whitespace-nowrap">
                    {c.name}
                    {c.index === numberIdx && <span className="text-sky-400"> {t('import.col_number_tag')}</span>}
                    {c.index === labelIdx && <span className="text-emerald-400"> {t('import.col_label_tag')}</span>}
                  </td>
                  <td className="py-1 text-slate-500">{c.samples.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="text-[11px] text-slate-500">
        {t('import.keep_all_columns')}
      </div>

      <div className="flex gap-2">
        <button className="btn" onClick={doPreview} disabled={busy || !numberValid}>
          {t('import.preview')}
        </button>
        <button
          className="btn btn-primary"
          onClick={commit}
          disabled={busy || !numberValid || (preview && preview.counts.valid === 0)}
        >
          {busy ? t('import.importing') : t('import.do_import')}
        </button>
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          {t('import.cancel')}
        </button>
      </div>

      {error && <div className="text-rose-400 text-sm">{error}</div>}
      <ResultSummary result={preview} />
    </div>
  )
}

function ImportPanel({ campaignId, onImported }) {
  const t = useT()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  // État du mode fichier tabulaire (xlsx/csv multi-colonnes).
  const [fileImport, setFileImport] = useState(null) // {filename, analysis, grid}

  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = String(reader.result || '')
        const b64 = result.includes(',') ? result.split(',')[1] : result
        resolve(b64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // permettre de re-sélectionner le même fichier
    setError(null)
    setBusy(true)
    try {
      const b64 = await readAsBase64(file)
      const res = await api.importAnalyze(campaignId, file.name, b64)
      // Fichier multi-colonnes → mode mapping. Sinon, on remplit le textarea.
      if (res.analysis.columns.length > 1) {
        setFileImport({ filename: file.name, analysis: res.analysis, grid: res.grid })
        setPreview(null)
      } else {
        // Une seule colonne : verser dans le collage pour le flux simple.
        const col0 = res.grid.map((r) => (r[0] || '')).filter(Boolean).join('\n')
        setText(col0)
        setFileImport(null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function doPreview() {
    setBusy(true)
    setError(null)
    try {
      setPreview(await api.importPreview(campaignId, text))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function doCommit() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.importCommit(campaignId, text)
      setText('')
      setPreview(null)
      onImported(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('import.title')}</h2>
        <label className="btn btn-ghost text-xs cursor-pointer">
          {t('import.load_file')}
          <input type="file" accept=".xlsx,.xlsm,.csv,.tsv,.txt" className="hidden" onChange={onFile} />
        </label>
      </div>

      {fileImport ? (
        <FileImport
          campaignId={campaignId}
          filename={fileImport.filename}
          analysis={fileImport.analysis}
          grid={fileImport.grid}
          onImported={(res) => {
            setFileImport(null)
            onImported(res)
          }}
          onCancel={() => setFileImport(null)}
        />
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {t('import.paste_help')}
          </p>
          <textarea
            className="input h-32 font-mono text-sm"
            placeholder={t('import.paste_placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn" onClick={doPreview} disabled={busy || !text.trim()}>
              {t('import.preview')}
            </button>
            {preview && preview.counts.valid > 0 && (
              <button className="btn btn-primary" onClick={doCommit} disabled={busy}>
                {t('import.validate', { n: preview.counts.valid })}
              </button>
            )}
          </div>
          {error && <div className="text-rose-400 text-sm">{error}</div>}
          <ResultSummary result={preview} />
        </>
      )}
      {fileImport && error && <div className="text-rose-400 text-sm">{error}</div>}
    </div>
  )
}

function LaunchPanel({ campaign, phone, onLaunched }) {
  const t = useT()
  const [sims, setSims] = useState([])
  const [simError, setSimError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [switchInfo, setSwitchInfo] = useState(null)
  const navigate = useNavigate()

  const loadSims = useCallback(async () => {
    try {
      const res = await api.getSims()
      setSims(res.sims)
      setSimError(res.sim_error)
      // Présélectionner la seule SIM joignable (mono-SIM).
      const reachable = res.sims.filter((s) => s.reachable)
      if (reachable.length === 1) setSelected(reachable[0])
    } catch (e) {
      setSimError(e.message)
    }
  }, [])

  useEffect(() => {
    loadSims()
  }, [loadSims])

  async function launch() {
    if (!selected) return
    setBusy(true)
    try {
      const res = await api.createRun({
        campaign_id: campaign.id,
        sim_subid: selected.sub_id,
        sim_operator: selected.operator,
        sim_slot: selected.slot_index,
      })
      setSwitchInfo(res.switch)
      // Laisser l'utilisateur lire la consigne de bascule avant d'entrer dans le cockpit.
      onLaunched()
      setTimeout(() => navigate(`/runs/${res.run_id}`), res.switch.ok ? 300 : 1500)
    } catch (e) {
      setSwitchInfo({ ok: false, message: e.message })
    } finally {
      setBusy(false)
    }
  }

  const hasNumbers = campaign.numbers && campaign.numbers.length > 0

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('launch.title')}</h2>
        <button className="btn btn-ghost text-xs" onClick={loadSims}>
          {t('launch.refresh_sim')}
        </button>
      </div>

      {simError && <div className="text-amber-400 text-sm">{simError}</div>}
      {!phone.device_connected && (
        <div className="text-rose-400 text-sm">{t('launch.phone_disconnected')}</div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {sims.map((sim) => (
          <SimCard
            key={sim.sub_id}
            sim={sim}
            selectable
            selected={selected?.sub_id === sim.sub_id}
            onSelect={setSelected}
          />
        ))}
        {sims.length === 0 && <div className="text-slate-500 text-sm">{t('launch.no_sim')}</div>}
      </div>

      {!hasNumbers && (
        <div className="text-amber-400 text-sm">
          {t('launch.import_first')}
        </div>
      )}

      {selected && hasNumbers && (
        <div className="border border-sky-800 bg-sky-950/40 rounded p-3 text-sm">
          {t('launch.confirm', {
            op: selected.operator,
            slot: selected.slot_index + 1,
            n: campaign.numbers.length,
          })}
          <div className="mt-2">
            <button className="btn btn-primary" onClick={launch} disabled={busy || !phone.device_connected}>
              {busy ? t('launch.starting') : t('launch.start')}
            </button>
          </div>
        </div>
      )}

      {switchInfo && (
        <div className={`text-sm rounded p-2 ${switchInfo.ok ? 'text-emerald-300' : 'text-amber-300 bg-amber-950/40'}`}>
          {switchInfo.message}
        </div>
      )}
    </div>
  )
}

export default function CampaignDetailPage({ phone }) {
  const t = useT()
  const { id } = useParams()
  const [campaign, setCampaign] = useState(null)
  const [error, setError] = useState(null)

  async function load() {
    try {
      setCampaign(await api.getCampaign(id))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [id])

  if (error) return <div className="text-rose-400">{error}</div>
  if (!campaign) return <div className="text-slate-500">{t('common.loading')}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-xs text-slate-500 hover:text-sky-400">
            {t('campaign.back')}
          </Link>
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          {campaign.notes && <p className="text-sm text-slate-500">{campaign.notes}</p>}
        </div>
        <Link to={`/campaigns/${id}/report`} className="btn btn-ghost">
          {t('campaign.view_report')}
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ImportPanel campaignId={id} onImported={load} />
        <LaunchPanel campaign={campaign} phone={phone} onLaunched={load} />
      </div>

      {/* Liste des numéros */}
      <div className="card">
        <h2 className="font-semibold mb-2">{t('campaign.numbers', { n: campaign.numbers.length })}</h2>
        {campaign.numbers.length === 0 ? (
          <div className="text-slate-500 text-sm">{t('campaign.no_numbers')}</div>
        ) : (
          <div className="max-h-64 overflow-auto text-sm">
            <table className="w-full">
              <thead className="text-xs text-slate-500 sticky top-0 bg-panel">
                <tr className="text-left">
                  <th className="py-1 w-10">#</th>
                  <th>{t('campaign.col_number')}</th>
                  <th>{t('campaign.col_label')}</th>
                </tr>
              </thead>
              <tbody>
                {campaign.numbers.map((n, i) => (
                  <tr key={n.id} className="border-t border-edge/50">
                    <td className="py-1 text-slate-600">{i + 1}</td>
                    <td className="tabular-nums">{n.national}</td>
                    <td className="text-slate-400">{n.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historique des passes */}
      <div className="card">
        <h2 className="font-semibold mb-2">{t('campaign.passes')}</h2>
        {campaign.runs.length === 0 ? (
          <div className="text-slate-500 text-sm">{t('campaign.no_passes')}</div>
        ) : (
          <div className="space-y-1 text-sm">
            {campaign.runs.map((r) => (
              <Link
                key={r.id}
                to={`/runs/${r.id}`}
                className="flex items-center justify-between border border-edge rounded px-3 py-2 hover:border-sky-600"
              >
                <span>
                  <b>{r.sim_operator}</b> ({t('campaign.slot', { n: r.sim_slot != null ? r.sim_slot + 1 : '?' })}) ·{' '}
                  {r.started_at?.slice(0, 16).replace('T', ' ')}
                </span>
                <span
                  className={`badge ${
                    r.status === 'terminee'
                      ? 'bg-emerald-900 text-emerald-300'
                      : r.status === 'interrompue'
                      ? 'bg-amber-900 text-amber-300'
                      : 'bg-sky-900 text-sky-300'
                  }`}
                >
                  {t('campaign.pass_status.' + r.status)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
