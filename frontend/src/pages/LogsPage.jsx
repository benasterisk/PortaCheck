import { useEffect, useState, useCallback } from 'react'
import { api } from '../api.js'
import { useT } from '../i18n/index.jsx'

export default function LogsPage() {
  const t = useT()
  const [logs, setLogs] = useState([])
  const [error, setError] = useState(null)
  const [auto, setAuto] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.getLogs(200)
      setLogs(res.logs)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [auto, load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('logs.title')}</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            {t('logs.auto_refresh')}
          </label>
          <button className="btn text-xs" onClick={load}>
            {t('logs.refresh')}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {t('logs.hint')}
      </p>

      {error && <div className="text-rose-400 text-sm">{error}</div>}

      <div className="card p-0 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-panel2 text-slate-500">
              <tr className="text-left">
                <th className="py-2 px-3 w-40">{t('logs.col_time')}</th>
                <th className="w-16">{t('logs.col_code')}</th>
                <th className="w-16">{t('logs.col_duration')}</th>
                <th>{t('logs.col_command')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => {
                const isErr = log.error || (log.code !== 0 && log.code != null)
                return (
                  <tr
                    key={i}
                    className={`border-t border-edge/40 ${isErr ? 'bg-rose-950/30' : ''}`}
                  >
                    <td className="py-1.5 px-3 text-slate-500 tabular-nums">
                      {log.ts?.slice(11, 23)}
                    </td>
                    <td className={log.code === 0 ? 'text-emerald-500' : 'text-rose-400'}>
                      {log.code}
                    </td>
                    <td className="text-slate-500 tabular-nums">{log.duration_ms}ms</td>
                    <td className="font-mono text-slate-300 break-all">
                      {log.command}
                      {log.error && <div className="text-rose-400 mt-0.5">⚠ {log.error}</div>}
                      {log.stdout && !isErr && (
                        <div className="text-slate-600 mt-0.5 truncate max-w-2xl" title={log.stdout}>
                          {log.stdout.slice(0, 120)}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-500">
                    {t('logs.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
