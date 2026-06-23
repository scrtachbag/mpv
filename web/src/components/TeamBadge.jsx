import { teamInfo } from '../lib/teams'

// Pastille d'équipe : sigle + couleur de marque. Placeholder vide si inconnue
// (garde l'alignement dans les listes).
export default function TeamBadge({ name, size = 22 }) {
  const t = teamInfo(name)
  if (!t) return <span className="team-badge empty" style={{ width: size, height: size }} />
  return (
    <span className="team-badge" title={t.label}
      style={{ background: t.color, color: t.fg || '#fff', width: size, height: size,
        fontSize: Math.round(size * 0.42) }}>
      {t.code}
    </span>
  )
}
