// Système i18n léger (sans dépendance externe).
// Langues : anglais, mandarin, hindi, espagnol, arabe (RTL), français.
// Défaut : langue du navigateur, repli anglais. Choix mémorisé (localStorage).

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { translations } from './translations.js'

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', rtl: false },
  { code: 'zh', name: 'Chinese', native: '中文', rtl: false },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', rtl: false },
  { code: 'es', name: 'Spanish', native: 'Español', rtl: false },
  { code: 'ar', name: 'Arabic', native: 'العربية', rtl: true },
  { code: 'de', name: 'German', native: 'Deutsch', rtl: false },
  { code: 'pt', name: 'Portuguese', native: 'Português', rtl: false },
  { code: 'fr', name: 'French', native: 'Français', rtl: false },
]

const SUPPORTED = LANGUAGES.map((l) => l.code)
const STORAGE_KEY = 'portacheck_lang'
const FALLBACK = 'en'

function detectInitialLang() {
  // 1) Choix mémorisé
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && SUPPORTED.includes(saved)) return saved
  } catch { /* localStorage indisponible */ }
  // 2) Langue du navigateur (préfixe : 'fr-FR' -> 'fr')
  const langs = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language || '']
  for (const l of langs) {
    const base = (l || '').toLowerCase().split('-')[0]
    if (SUPPORTED.includes(base)) return base
  }
  // 3) Repli anglais
  return FALLBACK
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLang)

  const setLang = useCallback((code) => {
    if (!SUPPORTED.includes(code)) return
    setLangState(code)
    try { localStorage.setItem(STORAGE_KEY, code) } catch { /* ignore */ }
  }, [])

  // Appliquer la direction (RTL pour l'arabe) et l'attribut lang sur <html>.
  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0]
    document.documentElement.lang = lang
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr'
  }, [lang])

  // t(key, vars?) : recherche la clé dans la langue courante, repli anglais,
  // puis la clé elle-même. Interpolation {var}.
  const t = useCallback((key, vars) => {
    const dict = translations[lang] || {}
    const fallback = translations[FALLBACK] || {}
    let str = dict[key] != null ? dict[key] : (fallback[key] != null ? fallback[key] : key)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${k}}`, String(v))
      }
    }
    return str
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

// Raccourci le plus courant : const t = useT()
export function useT() {
  return useI18n().t
}
