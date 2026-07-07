import { useAuth } from '../auth.jsx'
import Avatar from './Avatar.jsx'

const TOUR       = { key: 'tour', icon: '🚴', label: 'Le Tour' }
const CLASSEMENT = { key: 'classement', icon: '🏆', label: 'Classement' }
const REST = [
  { key: 'history', icon: '📅', label: 'Historique' },
  { key: 'chat', icon: '💬', label: 'Chat' },
  { key: 'rules', icon: '📖', label: 'Règles' },
]

export default function Nav({ view, setView, isMobile }) {
  const { profile, signOut } = useAuth()
  // Sur mobile, la page « Le Tour » est scindée : on ajoute un onglet Classement.
  // Sur desktop, le classement reste dans la page Le Tour (rien ne change).
  const tabs = isMobile ? [TOUR, CLASSEMENT, ...REST] : [TOUR, ...REST]

  return (
    <header className="nav">
      <div className="brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}>
        <img src={`${import.meta.env.BASE_URL}favicon.png`} alt="" width="26" height="26" />
        Mon Petit Vélo
      </div>
      <nav>
        {tabs.map((t) => (
          <button key={t.key}
            className={view === t.key ? 'tab active' : 'tab'}
            onClick={() => setView(t.key)}
            title={t.label} aria-label={t.label}>
            <span className="tab-icon" aria-hidden="true">{t.icon}</span>
            <span className="tab-text">{t.label}</span>
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
