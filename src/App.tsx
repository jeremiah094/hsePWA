import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Transactions from './pages/Transactions'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/upload', label: 'Upload' },
  { to: '/transactions', label: 'Transactions' },
]

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col">
        <header className="bg-ink text-white">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <span className="font-semibold text-lg tracking-tight">HSE Statements</span>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive ? 'bg-white text-ink' : 'text-slate-200 hover:bg-white/10'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/transactions" element={<Transactions />} />
          </Routes>
        </main>

        <footer className="text-center text-xs text-slate-400 py-4">
          Your statements are parsed and stored only in this browser — nothing is uploaded anywhere.
        </footer>
      </div>
    </HashRouter>
  )
}
