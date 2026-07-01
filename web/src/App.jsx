import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
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
  const { session, profile, loading, profileLoading, recovery } = useAuth()
  const [view, setView] = useState('tour')  // par défaut : Le Tour
  // Toute première connexion du compte : on ouvre les Règles, une seule fois.
  const introDone = useRef(false)
  useEffect(() => {
    if (profile && !introDone.current) {
      introDone.current = true
      if (!profile.seen_intro) {
        setView('rules')
        supabase.from('profiles').update({ seen_intro: true }).eq('id', profile.id)
      }
    }
  }, [profile])

  if (loading) return <div className="centered">Chargement…</div>
  if (recovery) return <div className="centered"><ResetPassword /></div>
  if (!session) return <div className="centered"><Login /></div>
  // Profil en cours de chargement (juste après connexion) : on attend plutôt
  // que d'afficher fugacement l'Onboarding « créer un compte ».
  if (!profile && profileLoading) return <div className="centered">Chargement…</div>
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
