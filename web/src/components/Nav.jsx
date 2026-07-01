import { useAuth } from '../auth.jsx'
import Avatar from './Avatar.jsx'

const TABS = [
  { key: 'tour', label: '🚴 Le Tour' },
  { key: 'history', label: '📅 Historique' },
  { key: 'chat', label: '💬 Chat' },
  { key: 'rules', label: '📖 Règles' },
]

export default function Nav({ view, setView }) {
  const { profile, signOut } = useAuth()
  const tabs = profile?.is_admin ? [...TABS, { key: 'admin', label: '⚙️ Admin' }] : TABS

  return (
    <header className="nav">
      <div className="brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width="26" height="26" />
        Mon Petit Vélo
      </div>
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
        <button className={`user-chip${view === 'profile' ? ' active' : ''}`}
          onClick={() => setView('profile')} title="Mon profil">
          <Avatar name={profile?.avatar} size={32} />
          <span className="pseudo">{profile?.pseudo}</span>
        </button>
        <button className="link logout" onClick={signOut} title="Déconnexion" aria-label="Déconnexion">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  )
}
