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
import Profile from './components/Profile.jsx'
import Rules from './components/Rules.jsx'
import Leaderboard from './components/Leaderboard.jsx'
import StageBackdrop from './components/StageBackdrop.jsx'
import { useIsMobile } from './lib/useIsMobile.js'

export default function App() {
  const { session, profile, loading, profileLoading, recovery } = useAuth()
  const isMobile = useIsMobile()
  const [view, setView] = useState('tour')  // par défaut : Le Tour
  // 'classement' n'existe qu'en mobile : sur desktop on retombe sur Le Tour.
  const activeView = (!isMobile && view === 'classement') ? 'tour' : view
  // Toute première connexion du compte : on ouvre les Règles, une seule fois.
  const introDone = useRef(false)
  useEffect(() => {
    if (profile && !introDone.current) {
      introDone.current = true
      if (!profile.seen_intro) {
        setView('rules')
        // .then() est indispensable : les builders postgrest-js sont lazy, la
        // requête n'est envoyée qu'au await/then (sinon seen_intro reste false
        // et les Règles se rouvrent à chaque connexion).
        supabase.from('profiles').update({ seen_intro: true }).eq('id', profile.id)
          .then(({ error }) => { if (error) console.error('seen_intro update:', error) })
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
      <StageBackdrop />
      <Nav view={activeView} setView={setView} isMobile={isMobile} />
      <main className="container">
        {activeView === 'tour' && <Dashboard withLeaderboard={!isMobile} />}
        {activeView === 'classement' && (
          <div className="card"><h2>🏆 Classement</h2><Leaderboard /></div>
        )}
        {activeView === 'history' && (
          <div className="card"><h2>📅 Historique des étapes</h2><History /></div>
        )}
        {activeView === 'chat' && <Chat />}
        {activeView === 'rules' && <Rules />}
        {activeView === 'profile' && <Profile />}
      </main>
      <footer className="footer muted">
        🚵 Mon Petit Vélo — entre amis, sans argent, pour la gloire. Côtes calculées depuis ProCyclingStats.
      </footer>
    </div>
  )
}
