import { Routes, Route, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { usePhoneState } from './usePhoneState.js'
import { useT } from './i18n/index.jsx'
import StatusBar from './components/StatusBar.jsx'
import LanguageSelector from './components/LanguageSelector.jsx'
import CampaignsPage from './pages/CampaignsPage.jsx'
import CampaignDetailPage from './pages/CampaignDetailPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import RunPage from './pages/RunPage.jsx'
import ReportPage from './pages/ReportPage.jsx'
import LogsPage from './pages/LogsPage.jsx'
import HelpPage from './pages/HelpPage.jsx'

function ThemeToggle() {
  const t = useT()
  const [light, setLight] = useState(() => document.documentElement.classList.contains('light'))
  useEffect(() => {
    document.documentElement.classList.toggle('light', light)
    document.documentElement.classList.toggle('dark', !light)
  }, [light])
  return (
    <button className="btn btn-ghost text-xs" onClick={() => setLight((v) => !v)} title={t('theme.toggle')}>
      {light ? t('theme.light') : t('theme.dark')}
    </button>
  )
}

export default function App() {
  const phone = usePhoneState()
  const t = useT()

  const navItems = [
    { to: '/', label: t('nav.campaigns'), end: true },
    { to: '/dashboard', label: t('nav.dashboard') },
    { to: '/logs', label: t('nav.logs') },
    { to: '/help', label: t('nav.help') },
  ]

  return (
    <div className="min-h-full flex flex-col">
      {/* Bandeau d'alerte global si téléphone déconnecté */}
      {!phone.device_connected && (
        <div className="bg-rose-950 border-b border-rose-800 text-rose-200 text-sm px-4 py-2 text-center">
          {t('app.disconnected_banner')}
        </div>
      )}

      <header className="border-b border-edge bg-panel/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sky-400 text-xl font-bold tracking-tight">PortaCheck</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">{t('app.tagline')}</span>
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm ${
                    isActive ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-panel2'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <StatusBar phone={phone} />
            <LanguageSelector />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage phone={phone} />} />
          <Route path="/dashboard" element={<DashboardPage phone={phone} />} />
          <Route path="/runs/:id" element={<RunPage phone={phone} />} />
          <Route path="/campaigns/:id/report" element={<ReportPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/help" element={<HelpPage />} />
        </Routes>
      </main>

      <footer className="border-t border-edge text-center text-[11px] text-slate-600 py-2">
        {t('app.footer')}
      </footer>
    </div>
  )
}
