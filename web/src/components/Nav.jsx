import { useAuth } from '../auth.jsx'
import Avatar from './Avatar.jsx'

const TABS = [
  { key: 'tour', label: '🚴 Le Tour' },
  { key: 'chat', label: '💬 Chat' },
]

export default function Nav({ view, setView }) {
  const { profile, signOut } = useAuth()
  const tabs = profile?.is_admin ? [...TABS, { key: 'admin', label: '⚙️ Admin' }] : TABS

  return (
    <header className="nav">
      <div className="brand">🚵 Mon Petit Vélo</div>
      <nav>
        {tabs.map((t) => (
          <button key={t.key}
            className={view === t.key ? 'tab active' : 'tab'}
            onClick={() => setView(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="user">
        <Avatar name={profile?.avatar} size={32} />
        <span className="pseudo">{profile?.pseudo}</span>
        <button className="link" onClick={signOut}>Déconnexion</button>
      </div>
    </header>
  )
}
