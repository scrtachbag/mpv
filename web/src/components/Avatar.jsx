import { avatarOf } from '../lib/avatars'

// Pastille ronde colorée avec l'emoji du personnage.
export default function Avatar({ name, size = 36, ring = false }) {
  const a = avatarOf(name)
  return (
    <span
      className={`avatar${ring ? ' ring' : ''}`}
      title={a.label}
      style={{ background: a.color, width: size, height: size, fontSize: Math.round(size * 0.52) }}
    >
      {a.emoji}
    </span>
  )
}
