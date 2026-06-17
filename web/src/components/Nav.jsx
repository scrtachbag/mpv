import { useAuth } from '../auth.jsx'

const TABS = [
  { key: 'today', label: 'Aujourd’hui' },
  { key: 'leaderboard', label: 'Classement' },
  { key: 'history', label: 'Historique' },
]

export default function Nav({ view, setView }) {
  const { profile, signOut } = useAuth()
  const tabs = profile?.is_admin ? [...TABS, { key: 'admin', label: 'Admin' }] : TABS

  return (
    <header className="nav">
      <div className="brand">🚴 MPV</div>
      <nav>
        {tabs.map((t) => (
          <button
            key={t.key}
            className={view === t.key ? 'tab active' : 'tab'}
            onClick={() => setView(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="user">
        <span className="muted">{profile?.pseudo}</span>
        <button className="link" onClick={signOut}>Déconnexion</button>
      </div>
    </header>
  )
}
