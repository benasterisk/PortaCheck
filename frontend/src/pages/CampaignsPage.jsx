import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useT } from '../i18n/index.jsx'

export default function CampaignsPage() {
  const t = useT()
  const [campaigns, setCampaigns] = useState([])
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      setCampaigns(await api.listCampaigns())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const { id } = await api.createCampaign(name.trim(), notes.trim())
      setName('')
      setNotes('')
      navigate(`/campaigns/${id}`)
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(id, e) {
    e.stopPropagation()
    if (!confirm(t('campaigns.delete_confirm'))) return
    await api.deleteCampaign(id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">{t('campaigns.title')}</h1>
        <span className="text-xs text-slate-500">{t('campaigns.count', { n: campaigns.length })}</span>
      </div>

      <form onSubmit={create} className="card flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="text-xs text-slate-400">{t('campaigns.name_label')}</label>
          <input
            className="input mt-1"
            placeholder={t('campaigns.name_placeholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex-1 w-full">
          <label className="text-xs text-slate-400">{t('campaigns.notes_label')}</label>
          <input className="input mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="btn btn-primary whitespace-nowrap" type="submit">
          {t('campaigns.new')}
        </button>
      </form>

      {error && <div className="text-rose-400 text-sm">{error}</div>}

      {loading ? (
        <div className="text-slate-500">{t('campaigns.loading')}</div>
      ) : campaigns.length === 0 ? (
        <div className="text-slate-500 text-sm">{t('campaigns.empty')}</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="card cursor-pointer hover:border-sky-600 transition-colors"
              onClick={() => navigate(`/campaigns/${c.id}`)}
            >
              <div className="flex items-start justify-between">
                <span className="font-semibold">{c.name}</span>
                <button
                  className="text-slate-600 hover:text-rose-400 text-xs"
                  onClick={(e) => remove(c.id, e)}
                  title={t('campaigns.delete_title')}
                >
                  ✕
                </button>
              </div>
              {c.notes && <p className="text-xs text-slate-500 mt-1">{c.notes}</p>}
              <div className="mt-3 flex gap-4 text-xs text-slate-400">
                <span>{t('campaigns.numbers_count', { n: c.number_count })}</span>
                <span>{t('campaigns.runs_count', { n: c.run_count })}</span>
              </div>
              <div className="text-[10px] text-slate-600 mt-2">{t('campaigns.created_on', { date: c.created_at?.slice(0, 10) })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
