// Aggregates the structured Help content per language.
// EN is the source; other languages fall back to EN if missing.
import { helpEn } from './help.en.js'
import { helpFr } from './help.fr.js'
import { helpZh } from './help.zh.js'
import { helpHi } from './help.hi.js'
import { helpEs } from './help.es.js'
import { helpAr } from './help.ar.js'
import { helpDe } from './help.de.js'
import { helpPt } from './help.pt.js'

const HELP = {
  en: helpEn, fr: helpFr, zh: helpZh, hi: helpHi,
  es: helpEs, ar: helpAr, de: helpDe, pt: helpPt,
}

export function getHelp(lang) {
  return HELP[lang] || HELP.en
}
