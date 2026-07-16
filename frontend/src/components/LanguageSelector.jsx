import { useI18n } from '../i18n/index.jsx'

// Sélecteur de langue (noms natifs). Le choix est mémorisé et applique le RTL.
export default function LanguageSelector() {
  const { lang, setLang, languages, t } = useI18n()
  return (
    <select
      className="bg-panel2 border border-edge rounded text-xs text-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
      value={lang}
      onChange={(e) => setLang(e.target.value)}
      title={t('lang.label')}
      aria-label={t('lang.label')}
    >
      {languages.map((l) => (
        <option key={l.code} value={l.code}>
          {l.native}
        </option>
      ))}
    </select>
  )
}
