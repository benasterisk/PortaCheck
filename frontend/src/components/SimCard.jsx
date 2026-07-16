// Carte SIM : opérateur, slot, subId, état réseau. Grisée si injoignable.
import { useT } from '../i18n/index.jsx'

// Le backend renvoie le libellé d'état en FR ; on le mappe vers une clé i18n.
const STATE_KEY = {
  'EN SERVICE': 'sim.state.in_service',
  'HORS SERVICE': 'sim.state.out_of_service',
  'INCONNU': 'sim.state.unknown',
}

export default function SimCard({ sim, selectable, selected, onSelect }) {
  const t = useT()
  const reachable = sim.reachable
  const base = 'card transition-all'
  const cls = reachable
    ? `${base} ${selected ? 'ring-2 ring-sky-500 border-sky-500' : ''} ${
        selectable ? 'cursor-pointer hover:border-sky-600' : ''
      }`
    : `${base} opacity-50 grayscale`

  const stateColor =
    sim.service_label === 'EN SERVICE'
      ? 'text-emerald-400'
      : sim.service_label === 'HORS SERVICE'
      ? 'text-rose-400'
      : 'text-slate-400'

  const stateLabel = t(STATE_KEY[sim.service_label] || 'sim.state.unknown')

  return (
    <div className={cls} onClick={reachable && selectable ? () => onSelect(sim) : undefined}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{sim.operator || 'SIM'}</span>
        {!reachable && <span className="badge bg-rose-900 text-rose-300">{t('sim.unreachable')}</span>}
        {reachable && selected && <span className="badge bg-sky-900 text-sky-300">{t('sim.selected')}</span>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-400">
        <span>{t('sim.slot')}</span>
        <span className="text-slate-200 text-right">{sim.slot_index + 1}</span>
        <span>{t('sim.subid')}</span>
        <span className="text-slate-200 text-right">{sim.sub_id}</span>
        <span>{t('sim.network_state')}</span>
        <span className={`text-right font-medium ${stateColor}`}>{stateLabel}</span>
      </div>
    </div>
  )
}
