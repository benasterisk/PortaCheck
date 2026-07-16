import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useT } from '../i18n/index.jsx'

const CAT_STYLE = {
  conforme: 'bg-emerald-900 text-emerald-300',
  routage_suspect: 'bg-amber-900 text-amber-300',
  portage_ko: 'bg-rose-900 text-rose-300',
  partiel: 'bg-slate-700 text-slate-300',
  non_teste: 'bg-slate-800 text-slate-500',
}

const VERDICT_STYLE = {
  OK: 'text-emerald-400',
  NOK: 'text-rose-400',
  SKIP: 'text-slate-500',
}

export default function ReportPage() {
  const t = useT()
  const { id } = useParams()
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterVerdict, setFilterVerdict] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.getReport(id).then(setReport).catch((e) => setError(e.message))
  }, [id])

  const filteredRows = useMemo(() => {
    if (!report) return []
    return report.rows.filter((row) => {
      if (filterCat !== 'all' && row.category !== filterCat) return false
      if (search) {
        const s = search.toLowerCase()
        if (
          !row.national.includes(search) &&
          !row.e164.includes(search) &&
          !(row.label || '').toLowerCase().includes(s)
        )
          return false
      }
      if (filterVerdict !== 'all') {
        const verdicts = Object.values(row.cells).map((c) => c.verdict)
        if (!verdicts.includes(filterVerdict)) return false
      }
      return true
    })
  }, [report, filterCat, filterVerdict, search])

  if (error) return <div className="text-rose-400">{error}</div>
  if (!report) return <div className="text-slate-500">{t('common.loading')}</div>

  const { runs, summary, summary_labels, total, campaign } = report

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/campaigns/${id}`} className="text-xs text-slate-500 hover:text-sky-400">
            {t('report.back', { name: campaign?.name })}
          </Link>
          <h1 className="text-xl font-semibold">{t('report.title')}</h1>
        </div>
        <div className="flex gap-2">
          <a className="btn" href={api.exportUrl(id, 'csv')}>
            {t('report.export_csv')}
          </a>
          <a className="btn btn-primary" href={api.exportUrl(id, 'xlsx')}>
            {t('report.export_xlsx')}
          </a>
        </div>
      </div>

      {/* Compteurs de synthèse */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(summary_labels).map(([cat]) => (
          <button
            key={cat}
            onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
            className={`card text-center transition-all ${
              filterCat === cat ? 'ring-2 ring-sky-500' : ''
            }`}
          >
            <div className="text-2xl font-bold tabular-nums">{summary[cat] || 0}</div>
            <div className="text-[11px] text-slate-400 mt-1 leading-tight">{t('report.cat.' + cat)}</div>
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="input max-w-xs"
          placeholder={t('report.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[10rem]" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="all">{t('report.all_categories')}</option>
          {Object.entries(summary_labels).map(([cat]) => (
            <option key={cat} value={cat}>
              {t('report.cat.' + cat)}
            </option>
          ))}
        </select>
        <select
          className="input max-w-[10rem]"
          value={filterVerdict}
          onChange={(e) => setFilterVerdict(e.target.value)}
        >
          <option value="all">{t('report.all_verdicts')}</option>
          <option value="OK">OK</option>
          <option value="NOK">NOK</option>
          <option value="SKIP">SKIP</option>
        </select>
        <span className="text-xs text-slate-500">
          {t('report.filtered_of', { shown: filteredRows.length, total })}
        </span>
      </div>

      {runs.length === 0 && (
        <div className="text-amber-400 text-sm">{t('report.no_pass')}</div>
      )}

      {/* Tableau croisé */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-edge">
              <th className="py-2 pr-3">{t('report.col_number')}</th>
              <th className="pr-3">{t('report.col_label')}</th>
              {runs.map((run) => (
                <th key={run.id} className="pr-3">
                  {run.sim_operator}
                  <div className="text-[10px] text-slate-600 font-normal">
                    {run.started_at?.slice(0, 10)}
                  </div>
                </th>
              ))}
              <th className="pr-3">{t('report.classification')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.number_id} className="border-b border-edge/40 hover:bg-panel2/50">
                <td className="py-2 pr-3 tabular-nums">{row.national}</td>
                <td className="pr-3 text-slate-400">{row.label}</td>
                {runs.map((run) => {
                  const cell = row.cells[run.id] || {}
                  return (
                    <td key={run.id} className="pr-3">
                      {cell.verdict ? (
                        <span className={VERDICT_STYLE[cell.verdict] || ''}>
                          {cell.verdict}
                          {cell.duration_s != null && (
                            <span className="text-slate-600 text-xs"> ·{cell.duration_s}s</span>
                          )}
                          {cell.comment && (
                            <span className="block text-[10px] text-slate-500 truncate max-w-[12rem]" title={cell.comment}>
                              {cell.comment}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </td>
                  )
                })}
                <td className="pr-3">
                  <span className={`badge ${CAT_STYLE[row.category] || ''}`}>{t('report.cat.' + row.category)}</span>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={runs.length + 3} className="py-4 text-center text-slate-500">
                  {t('report.no_match')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
