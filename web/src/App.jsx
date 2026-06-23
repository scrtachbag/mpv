import { useState } from 'react'
import { useAuth } from './auth.jsx'
import Login from './components/Login.jsx'
import Onboarding from './components/Onboarding.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import Nav from './components/Nav.jsx'
import Dashboard from './components/Dashboard.jsx'
import History from './components/History.jsx'
import Chat from './components/Chat.jsx'
import Admin from './components/Admin.jsx'
import Profile from './components/Profile.jsx'
import Rules from './components/Rules.jsx'

export default function App() {
  const { session, profile, loading, recovery } = useAuth()
  const [view, setView] = useState('tour')

  if (loading) return <div className="centered">Chargement…</div>
  if (recovery) return <div className="centered"><ResetPassword /></div>
  if (!session) return <div className="centered"><Login /></div>
  if (!profile) return <div className="centered"><Onboarding /></div>

  return (
    <div className="app">
      <Nav view={view} setView={setView} />
      <main className="container">
        {view === 'tour' && <Dashboard />}
        {view === 'history' && (
          <div className="card"><h2>📅 Historique des étapes</h2><History /></div>
        )}
        {view === 'chat' && <Chat />}
        {view === 'rules' && <Rules />}
        {view === 'profile' && <Profile />}
        {view === 'admin' && profile.is_admin && <Admin />}
      </main>
      <footer className="footer muted">
        🚵 Mon Petit Vélo — entre amis, sans argent, pour la gloire. Côtes calculées depuis ProCyclingStats.
      </footer>
    </div>
  )
}
