import { useState } from 'react'
import { api } from '../api.js'
import SimCard from '../components/SimCard.jsx'
import { useT } from '../i18n/index.jsx'

export default function DashboardPage({ phone }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function refresh() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await api.refreshSims()
      setMsg(res.sim_error ? res.sim_error : t('dashboard.refreshed', { n: res.sims.length }))
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  const sims = phone.sims || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('dashboard.title')}</h1>
        <button className="btn" onClick={refresh} disabled={busy}>
          {busy ? t('dashboard.refreshing') : t('dashboard.refresh')}
        </button>
      </div>

      {!phone.device_connected && (
        <div className="card border-rose-800 bg-rose-950/40 text-rose-200 text-sm">
          {t('dashboard.disconnected')}
        </div>
      )}

      {phone.sim_error && <div className="text-amber-400 text-sm">{phone.sim_error}</div>}
      {msg && <div className="text-slate-400 text-sm">{msg}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sims.map((sim) => (
          <SimCard key={sim.sub_id} sim={sim} />
        ))}
        {sims.length === 0 && phone.device_connected && (
          <div className="text-slate-500 text-sm">{t('dashboard.no_sim')}</div>
        )}
      </div>

      <div className="text-xs text-slate-600">
        {t('dashboard.hint')}
        {phone.ts && <span> · {t('dashboard.last_update', { time: phone.ts.slice(11, 19) })}</span>}
      </div>
    </div>
  )
}
