// In-app user guide, rendered from structured, translatable content (8 languages).
import { useI18n } from '../i18n/index.jsx'
import { getHelp } from '../i18n/help.js'

// Convert inline **bold** and `code` markers into React nodes.
function renderInline(text) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let m
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) {
      parts.push(<b key={key++}>{token.slice(2, -2)}</b>)
    } else {
      parts.push(<code key={key++} className="text-slate-400">{token.slice(1, -1)}</code>)
    }
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function Kbd({ children }) {
  return <span className="kbd mx-0.5">{children}</span>
}

const BADGE_CLASS = {
  emerald: 'bg-emerald-900 text-emerald-300',
  amber: 'bg-amber-900 text-amber-300',
  rose: 'bg-rose-900 text-rose-300',
  slate: 'bg-slate-700 text-slate-300',
  slatedim: 'bg-slate-800 text-slate-500',
}

function Block({ block }) {
  switch (block.type) {
    case 'p':
      return <p>{renderInline(block.text)}</p>
    case 'note':
      return <p className="text-slate-500">{renderInline(block.text)}</p>
    case 'ul':
      return (
        <ul className="list-disc list-inside space-y-1">
          {block.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
        </ul>
      )
    case 'steps':
      return (
        <div className="space-y-3">
          {block.items.map((it, i) => (
            <div key={i} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-sky-600 text-white text-xs flex items-center justify-center font-semibold">
                {i + 1}
              </span>
              <div className="flex-1 pt-0.5">{renderInline(it)}</div>
            </div>
          ))}
        </div>
      )
    case 'shortcuts':
      return (
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
          {block.items.map((s, i) => (
            <div key={i}>
              {s.keys.map((k, j) => <Kbd key={j}>{k}</Kbd>)} {s.label}
            </div>
          ))}
        </div>
      )
    case 'legend':
      return (
        <ul className="space-y-1">
          {block.items.map((it, i) => (
            <li key={i}>
              <span className={`badge ${BADGE_CLASS[it.badge] || ''}`}>{it.title}</span> {it.text}
            </li>
          ))}
        </ul>
      )
    default:
      return null
  }
}

export default function HelpPage() {
  const { lang } = useI18n()
  const help = getHelp(lang)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">{help.title}</h1>
        <p className="text-slate-400 mt-1">{help.intro}</p>
      </div>

      {help.sections.map((section, i) => (
        <section key={i} className="card space-y-3">
          <h2 className="text-lg font-semibold text-sky-400">{section.title}</h2>
          <div className="space-y-2 text-sm text-slate-300 leading-relaxed">
            {section.blocks.map((block, j) => <Block key={j} block={block} />)}
          </div>
        </section>
      ))}

      <p className="text-xs text-slate-600 text-center pt-2">{help.footer}</p>
    </div>
  )
}
