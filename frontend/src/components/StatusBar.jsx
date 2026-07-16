// Bandeau global : état de connexion du téléphone + WS, affiché en haut.
import { useT } from '../i18n/index.jsx'

export default function StatusBar({ phone }) {
  const t = useT()
  const connected = phone.device_connected
  const wsOk = phone.connected_ws

  let deviceLabel = t('status.disconnected')
  let dot = 'bg-rose-500'
  if (connected) {
    deviceLabel = t('status.connected')
    dot = 'bg-emerald-500'
  } else if (phone.device_state === 'unauthorized') {
    deviceLabel = t('status.unauthorized')
    dot = 'bg-amber-500'
  } else if (phone.device_state === 'offline') {
    deviceLabel = t('status.offline')
    dot = 'bg-amber-500'
  }

  const callLabel =
    phone.call_state === 2
      ? t('status.call.in_call')
      : phone.call_state === 1
      ? t('status.call.ringing')
      : t('status.call.inactive')

  return (
    <div className="flex items-center gap-4 text-xs">
      <span className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${dot} ${connected ? 'animate-none' : 'animate-pulse'}`} />
        {deviceLabel}
      </span>
      <span className="text-slate-500">|</span>
      <span className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            phone.call_state === 2 ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'
          }`}
        />
        {t('status.call')} : {callLabel}
        {phone.call_active && (
          <span className="text-sky-400 tabular-nums">· {phone.call_elapsed_s.toFixed(0)}s</span>
        )}
      </span>
      <span className="text-slate-500">|</span>
      <span className={wsOk ? 'text-slate-500' : 'text-amber-400'}>
        {wsOk ? t('status.ws.on') : t('status.ws.off')}
      </span>
    </div>
  )
}
