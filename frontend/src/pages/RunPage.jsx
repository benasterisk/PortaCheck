import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../api.js'
import { useT } from '../i18n/index.jsx'

// Le cockpit : cœur de l'application. Travail au clavier, mains sur le clavier,
// audio au casque. Affichage très gros du numéro courant.
//
// Navigation libre : ◄ ► pour se positionner sur n'importe quel numéro du fichier,
// corriger un verdict (remplace), ajouter une note (horodatée, cumulée), relancer
// un appel. Commentaires fréquents proposés en tuiles + liste déroulante.

const VERDICT_BADGE = {
  OK: 'bg-emerald-900 text-emerald-300',
  NOK: 'bg-rose-900 text-rose-300',
  SKIP: 'bg-slate-700 text-slate-400',
}

export default function RunPage({ phone }) {
  const t = useT()
  const verdictLabel = (v) => t(`run.verdict.${v}`)
  const { id } = useParams()
  const navigate = useNavigate()

  const [run, setRun] = useState(null)
  const [campaign, setCampaign] = useState(null)
  const [items, setItems] = useState([])          // tous les numéros + état
  const [index, setIndex] = useState(0)           // position courante
  const [progress, setProgress] = useState({ total: 0, done: 0, remaining: 0 })
  const [error, setError] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  const [dialDelay, setDialDelay] = useState(2)
  const [statusMsg, setStatusMsg] = useState(null)
  const [dialing, setDialing] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  const commentRef = useRef(null)
  const autoTimerRef = useRef(null)
  const nextTimerRef = useRef(null)
  const dialingTimerRef = useRef(null)
  const recomposeTimerRef = useRef(null)
  const callStartRef = useRef(null)
  const lastDurationRef = useRef(null)
  const phoneRef = useRef(phone)
  phoneRef.current = phone
  const minDelayRef = useRef(1)
  const indexRef = useRef(0)
  indexRef.current = index

  const clearAllTimers = useCallback(() => {
    for (const r of [autoTimerRef, nextTimerRef, dialingTimerRef, recomposeTimerRef]) {
      if (r.current) {
        clearTimeout(r.current)
        r.current = null
      }
    }
  }, [])

  // --- Chargement de la liste des numéros + méta de la passe ---
  const reload = useCallback(async (opts = {}) => {
    try {
      // Reprise explicite d'une passe interrompue au 1er chargement.
      if (opts.resume) {
        await api.getRun(id, { resume: true })
      }
      const data = await api.getRunNumbers(id)
      setRun(data.run)
      setItems(data.numbers)
      setProgress(data.progress)
      setError(null)
      if (data.run) {
        // Charger la campagne (nom) une seule fois.
        setCampaign((c) => c || { id: data.run.campaign_id })
      }
      return data
    } catch (e) {
      setError(e.message)
      return null
    }
  }, [id])

  // Montage : charger, se positionner au 1er numéro sans verdict, charger config + suggestions.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const data = await reload({ resume: true })
      if (!mounted || !data) return
      const firstPending = data.first_pending
      setIndex(firstPending != null ? firstPending : 0)
      const camp = await api.getCampaign(data.run.campaign_id).catch(() => null)
      if (mounted && camp) setCampaign(camp)
    })()
    return () => { mounted = false }
  }, [reload])

  useEffect(() => {
    api.getProfile().then((p) => {
      setDialDelay(p.config?.dial_delay_default_s ?? 2)
      minDelayRef.current = p.config?.dial_delay_min_s ?? 1
    })
    refreshSuggestions()
  }, [])

  const refreshSuggestions = useCallback(async () => {
    try {
      const res = await api.getCommentSuggestions()
      setSuggestions(res.suggestions || [])
    } catch { /* non bloquant */ }
  }, [])

  const current = items[index] || null
  const extras = current?.extras || {}
  const total = progress.total
  const currentVerdict = current?.verdict || null
  const commentHistory = current?.comment || ''

  // --- Mesure de durée : horodater au VRAI décroché ---
  useEffect(() => {
    if (phone.call_state === 2) {
      if (callStartRef.current === null) callStartRef.current = Date.now()
    } else if (phone.call_state === 0) {
      if (callStartRef.current !== null) {
        lastDurationRef.current = (Date.now() - callStartRef.current) / 1000
        callStartRef.current = null
      }
    }
  }, [phone.call_state])

  // Quand on change de numéro, vider le champ de saisie (l'historique reste affiché).
  useEffect(() => {
    setComment('')
    callStartRef.current = null
    lastDurationRef.current = null
  }, [index])

  const runActive = run?.status === 'en_cours'

  // --- Navigation ---
  const goTo = useCallback((i) => {
    if (i < 0 || i >= total) return
    clearAllTimers()
    setStatusMsg(null)
    setIndex(i)
  }, [total, clearAllTimers])

  const goPrev = useCallback(() => goTo(indexRef.current - 1), [goTo])
  const goNext = useCallback(() => goTo(indexRef.current + 1), [goTo])

  // --- Actions d'appel ---
  const doDial = useCallback(async () => {
    if (!current || busy || dialing || !phoneRef.current.device_connected) return
    if (!runActive) { setStatusMsg({ type: 'error', text: t('run.not_active') }); return }
    setDialing(true)
    setBusy(true)
    setStatusMsg(null)
    callStartRef.current = null
    lastDurationRef.current = null
    try {
      await api.dial(run.id, current.id)
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message })
    } finally {
      setBusy(false)
      dialingTimerRef.current = setTimeout(() => setDialing(false), 500)
    }
  }, [current, busy, dialing, run, runActive])

  const doHangup = useCallback(async () => {
    if (!run) return
    try {
      await api.hangup(run.id)
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message })
    }
  }, [run])

  const doDialFor = useCallback(async (num) => {
    const ph = phoneRef.current
    if (!num || busy || dialing || !ph.device_connected || ph.call_active) return
    setDialing(true)
    callStartRef.current = null
    lastDurationRef.current = null
    try {
      await api.dial(run.id, num.id)
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message })
    } finally {
      dialingTimerRef.current = setTimeout(() => setDialing(false), 500)
    }
  }, [run, busy, dialing])

  // Enregistre un verdict sur le numéro COURANT (par index). Verdict remplace,
  // commentaire s'ajoute horodaté. Avance au suivant sauf en mode correction.
  const submitVerdict = useCallback(async (verdict) => {
    if (!current || busy) return
    clearAllTimers()
    setBusy(true)
    setStatusMsg(null)
    let duration = null
    if (callStartRef.current != null) duration = (Date.now() - callStartRef.current) / 1000
    else if (lastDurationRef.current != null) duration = lastDurationRef.current
    const wasNew = current.verdict == null  // 1re fois vs correction
    try {
      await api.verdict(run.id, {
        number_id: current.id,
        verdict,
        comment: comment.trim(),
        duration_s: duration != null ? Math.round(duration * 10) / 10 : null,
      })
      setComment('')
      callStartRef.current = null
      lastDurationRef.current = null
      refreshSuggestions()
      const data = await reload()
      const totalNow = data?.progress.total ?? total
      const remainingNow = data?.progress.remaining ?? 0
      if (remainingNow === 0) {
        // Tous les numéros sont traités → message de fin clair (le bandeau apparaît).
        setStatusMsg({ type: 'ok', text: t('run.all_done_msg') })
      } else if (wasNew) {
        // Nouveau verdict, il reste des numéros : avancer au prochain SANS verdict.
        const findNextPending = (fromIdx) => {
          if (!data) return fromIdx + 1
          for (let i = fromIdx + 1; i < data.numbers.length; i++) {
            if (data.numbers[i].verdict == null) return i
          }
          // sinon, reboucler au premier non traité avant la position courante
          for (let i = 0; i < data.numbers.length; i++) {
            if (data.numbers[i].verdict == null) return i
          }
          return fromIdx
        }
        const nextIdx = findNextPending(indexRef.current)
        const delayMs = Math.max(minDelayRef.current, dialDelay) * 1000
        setStatusMsg({ type: 'info', text: t('run.verdict_saved', { verdict, delay: dialDelay }) })
        nextTimerRef.current = setTimeout(() => {
          setIndex(nextIdx)
          if (autoMode && data && phoneRef.current.device_connected) {
            const nextNum = data.numbers[nextIdx]
            autoTimerRef.current = setTimeout(() => doDialFor(nextNum), 200)
          }
        }, delayMs)
      } else {
        // Correction : rester sur la fiche.
        setStatusMsg({ type: 'ok', text: t('run.verdict_corrected', { verdict }) })
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message })
    } finally {
      setBusy(false)
    }
  }, [current, busy, run, comment, dialDelay, autoMode, reload, doDialFor, clearAllTimers, refreshSuggestions, total])

  const recompose = useCallback(async () => {
    if (phoneRef.current.call_active) await doHangup()
    const delayMs = Math.max(minDelayRef.current, 1) * 1000
    if (recomposeTimerRef.current) clearTimeout(recomposeTimerRef.current)
    recomposeTimerRef.current = setTimeout(doDial, delayMs)
  }, [doHangup, doDial])

  const doStop = useCallback(async () => {
    clearAllTimers()
    try {
      await api.stopRun(run.id)
      navigate(`/campaigns/${run.campaign_id}`)
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message })
    }
  }, [run, navigate, clearAllTimers])

  const doFinish = useCallback(async () => {
    clearAllTimers()
    try {
      await api.finishRun(run.id)
      navigate(`/campaigns/${run.campaign_id}/report`)
    } catch (e) {
      setStatusMsg({ type: 'error', text: e.message })
    }
  }, [run, navigate, clearAllTimers])

  // Cliquer une tuile de commentaire : remplit le champ (remplace la saisie en cours).
  const applySuggestion = useCallback((text) => {
    setComment(text)
    commentRef.current?.focus()
  }, [])

  // --- Raccourcis clavier ---
  useEffect(() => {
    function onKey(e) {
      const el = document.activeElement
      const tag = el?.tagName
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable
      if (e.key === 'Escape') { e.preventDefault(); doHangup(); return }
      // Flèches gauche/droite : navigation (même hors focus).
      if (e.key === 'ArrowLeft' && !editable) { e.preventDefault(); goPrev(); return }
      if (e.key === 'ArrowRight' && !editable) { e.preventDefault(); goNext(); return }
      if (editable) return
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); doDial(); break
        case 'o': e.preventDefault(); submitVerdict('OK'); break
        case 'n': e.preventDefault(); submitVerdict('NOK'); break
        case 's': e.preventDefault(); submitVerdict('SKIP'); break
        case 'r': e.preventDefault(); recompose(); break
        case 'c': e.preventDefault(); commentRef.current?.focus(); break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doDial, doHangup, submitVerdict, recompose, goPrev, goNext])

  useEffect(() => () => clearAllTimers(), [clearAllTimers])

  if (error) return <div className="text-rose-400">{error}</div>
  if (!run) return <div className="text-slate-500">{t('run.loading')}</div>

  const disconnected = !phone.device_connected
  const allDone = progress.remaining === 0 && total > 0
  const slotDisplay = run.sim_slot != null ? run.sim_slot + 1 : '?'

  return (
    <div className="space-y-5">
      {/* En-tête passe */}
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/campaigns/${run.campaign_id}`} className="text-xs text-slate-500 hover:text-sky-400">
            {t('run.back', { name: campaign?.name || '' })}
          </Link>
          <h1 className="text-lg font-semibold">
            {t('run.pass', { op: run.sim_operator, slot: slotDisplay })}
            <span className={`ml-2 badge ${run.status === 'en_cours' ? 'bg-sky-900 text-sky-300' : run.status === 'terminee' ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'}`}>
              {t(`campaign.pass_status.${run.status}`)}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            {t('run.delay')}
            <input type="number" min={1} value={dialDelay}
              onChange={(e) => setDialDelay(Math.max(1, Number(e.target.value)))}
              className="input w-16 py-1" />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={autoMode}
              onChange={(e) => {
                if (e.target.checked) {
                  if (confirm(t('run.auto_confirm'))) setAutoMode(true)
                } else setAutoMode(false)
              }} />
            <span className={autoMode ? 'text-amber-400' : 'text-slate-400'}>{t('run.auto_mode')}</span>
          </label>
          {allDone && runActive && (
            <button className="btn btn-ok text-xs" onClick={doFinish}>{t('run.finish_report')}</button>
          )}
          <button className="btn btn-warn text-xs" onClick={doStop}>{t('run.stop')}</button>
        </div>
      </div>

      {disconnected && (
        <div className="card border-rose-800 bg-rose-950/40 text-rose-200">
          {t('run.disconnected')}
        </div>
      )}

      {/* Bandeau de fin : tous les numéros sont traités */}
      {allDone && (
        <div className="card border-emerald-700 bg-emerald-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <div className="text-emerald-300 font-semibold">{t('run.all_done_title')}</div>
            <div className="text-sm text-slate-400">{t('run.treated_of', { done: progress.done, total })}</div>
          </div>
          <div className="flex gap-2">
            {runActive && (
              <button className="btn btn-ok" onClick={doFinish}>{t('run.finish_report')}</button>
            )}
            <Link to={`/campaigns/${run.campaign_id}/report`} className="btn">{t('campaign.view_report')}</Link>
          </div>
        </div>
      )}

      {/* Progression */}
      <div className="flex items-center gap-3 text-sm">
        <div className="flex-1 h-2 bg-panel2 rounded overflow-hidden">
          <div className="h-full bg-sky-600 transition-all"
            style={{ width: `${total ? (progress.done / total) * 100 : 0}%` }} />
        </div>
        <span className="tabular-nums text-slate-400">{t('run.progress', { done: progress.done, total })}</span>
      </div>

      {/* Barre de navigation */}
      <div className="flex items-center justify-between gap-3">
        <button className="btn" onClick={goPrev} disabled={index <= 0} title={t('run.prev')}>
          {t('run.prev')}
        </button>
        <div className="text-center">
          <div className="text-xs text-slate-500">{t('run.record_of', { n: index + 1, total })}</div>
          {currentVerdict && (
            <span className={`badge ${VERDICT_BADGE[currentVerdict]} mt-1`}>
              {t('run.current_verdict', { verdict: verdictLabel(currentVerdict) })}
            </span>
          )}
          {!currentVerdict && <span className="badge bg-slate-800 text-slate-500 mt-1">{t('run.not_treated')}</span>}
        </div>
        <button className="btn" onClick={goNext} disabled={index >= total - 1} title={t('run.next')}>
          {t('run.next')}
        </button>
      </div>

      {/* Cockpit : numéro courant très gros */}
      <div className="card text-center py-8 space-y-3">
        <div className="text-xs uppercase tracking-widest text-slate-500">
          {currentVerdict ? t('run.number_treated') : t('run.number_to_call')}
        </div>
        <div className="text-6xl font-bold tabular-nums tracking-wider">
          {current ? current.national : '—'}
        </div>
        {current?.label && <div className="text-lg text-slate-400">{current.label}</div>}

        {Object.keys(extras).length > 0 && (
          <div className="max-w-3xl mx-auto mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-left text-sm">
            {Object.entries(extras).map(([k, v]) => (
              <div key={k} className="flex gap-2 border-b border-edge/30 py-0.5 min-w-0">
                <span className="text-slate-500 shrink-0 max-w-[45%] truncate" title={k}>{k} :</span>
                <span className="text-slate-300 min-w-0 break-words">{v}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-6 pt-2 text-sm">
          <span className={`badge ${phone.call_state === 2 ? 'bg-sky-900 text-sky-300' : phone.call_state === 1 ? 'bg-amber-900 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
            {phone.call_state === 2 ? t('status.call.in_call') : phone.call_state === 1 ? t('status.call.ringing') : t('status.call.inactive')}
          </span>
          {phone.call_active && (
            <span className="tabular-nums text-sky-400 text-lg">{phone.call_elapsed_s.toFixed(0)}s</span>
          )}
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <button className="btn btn-primary py-3" onClick={doDial} disabled={busy || disconnected || dialing || !runActive}>
          <div>{currentVerdict ? t('run.recall') : t('run.dial')}</div>
          <div className="text-[10px] opacity-70">{t('run.help.dial') === 'Dial' ? 'Space' : 'Space'}</div>
        </button>
        <button className="btn py-3" onClick={doHangup} disabled={disconnected}>
          <div>{t('run.hangup')}</div>
          <div className="text-[10px] opacity-70">Esc</div>
        </button>
        <button className="btn btn-ok py-3" onClick={() => submitVerdict('OK')} disabled={busy}>
          <div>{t('run.ok')}</div>
          <div className="text-[10px] opacity-70">O</div>
        </button>
        <button className="btn btn-nok py-3" onClick={() => submitVerdict('NOK')} disabled={busy}>
          <div>{t('run.nok')}</div>
          <div className="text-[10px] opacity-70">N</div>
        </button>
        <button className="btn py-3" onClick={() => submitVerdict('SKIP')} disabled={busy}>
          <div>{t('run.skip')}</div>
          <div className="text-[10px] opacity-70">S</div>
        </button>
        <button className="btn py-3" onClick={recompose} disabled={busy || disconnected || !runActive}>
          <div>{t('run.redial')}</div>
          <div className="text-[10px] opacity-70">R</div>
        </button>
      </div>

      {/* Commentaire + suggestions */}
      <div>
        <label className="text-xs text-slate-400 flex items-center gap-2">
          {t('run.comment_label', { key: 'C' })}
        </label>
        {commentHistory && (
          <div className="mt-1 mb-1 text-xs text-slate-400 bg-panel2 border border-edge rounded p-2 max-h-24 overflow-auto whitespace-pre-wrap">
            {commentHistory}
          </div>
        )}
        <input
          ref={commentRef}
          className="input mt-1"
          list="comment-suggestions"
          placeholder={t('run.comment_placeholder')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <datalist id="comment-suggestions">
          {suggestions.map((s) => (
            <option key={s.text} value={s.text} />
          ))}
        </datalist>

        {/* Tuiles cliquables des commentaires fréquents */}
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.slice(0, 12).map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => applySuggestion(s.text)}
                className="text-xs px-2 py-1 rounded border border-edge bg-panel2 hover:border-sky-600 hover:bg-slate-700 text-slate-300"
                title={t('run.used_times', { n: s.count })}
              >
                {s.text}
              </button>
            ))}
          </div>
        )}
      </div>

      {statusMsg && (
        <div className={`text-sm ${statusMsg.type === 'error' ? 'text-rose-400' : statusMsg.type === 'ok' ? 'text-emerald-400' : 'text-slate-400'}`}>
          {statusMsg.text}
        </div>
      )}

      {/* Aide raccourcis */}
      <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 border-t border-edge pt-3">
        <span><span className="kbd">←</span> <span className="kbd">→</span> {t('run.help.navigate')}</span>
        <span><span className="kbd">Space</span> {t('run.help.dial')}</span>
        <span><span className="kbd">O</span> {t('run.ok')}</span>
        <span><span className="kbd">N</span> {t('run.nok')}</span>
        <span><span className="kbd">S</span> {t('run.skip')}</span>
        <span><span className="kbd">R</span> {t('run.redial')}</span>
        <span><span className="kbd">C</span> {t('run.help.comment')}</span>
        <span><span className="kbd">Esc</span> {t('run.help.hangup')}</span>
      </div>
    </div>
  )
}
