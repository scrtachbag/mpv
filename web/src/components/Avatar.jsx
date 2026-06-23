import { avatarOf } from '../lib/avatars'

// Pastille ronde colorée : emoji (personnage) ou sigle (équipe).
export default function Avatar({ name, size = 36, ring = false }) {
  const a = avatarOf(name)
  const isCode = Boolean(a.code)
  return (
    <span
      className={`avatar${ring ? ' ring' : ''}`}
      title={a.label}
      style={{
        background: a.color,
        width: size, height: size,
        fontSize: Math.round(size * (isCode ? 0.34 : 0.52)),
        color: isCode ? (a.fg || '#fff') : undefined,
        fontWeight: isCode ? 800 : undefined,
        letterSpacing: isCode ? '-.5px' : undefined,
      }}
    >
      {isCode ? a.code : a.emoji}
    </span>
  )
}
