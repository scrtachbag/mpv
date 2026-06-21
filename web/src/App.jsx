import { useState } from 'react'
import { useAuth } from './auth.jsx'
import Login from './components/Login.jsx'
import Onboarding from './components/Onboarding.jsx'
import ResetPassword from './components/ResetPassword.jsx'
import Nav from './components/Nav.jsx'
import TodayBet from './components/TodayBet.jsx'
import Leaderboard from './components/Leaderboard.jsx'
import History from './components/History.jsx'
import Admin from './components/Admin.jsx'

export default function App() {
  const { session, profile, loading, recovery } = useAuth()
  const [view, setView] = useState('today')

  if (loading) return <div className="centered">Chargement…</div>
  if (recovery) return <div className="centered"><ResetPassword /></div>
  if (!session) return <div className="centered"><Login /></div>
  if (!profile) return <div className="centered"><Onboarding /></div>

  return (
    <div className="app">
      <Nav view={view} setView={setView} />
      <main className="container">
        {view === 'today' && <TodayBet />}
        {view === 'leaderboard' && <Leaderboard />}
        {view === 'history' && <History />}
        {view === 'admin' && profile.is_admin && <Admin />}
      </main>
      <footer className="footer muted">
        MPV — entre amis, sans argent. Côtes calculées depuis ProCyclingStats.
      </footer>
    </div>
  )
}
