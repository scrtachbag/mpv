import { useState } from 'react'
import { avatarOf } from '../lib/avatars'

// Pastille ronde : logo d'équipe (image) sinon sigle, ou emoji (personnage).
export default function Avatar({ name, size = 36, ring = false }) {
  const a = avatarOf(name)
  const isTeam = Boolean(a.code)
  const [imgError, setImgError] = useState(false)

  // Équipe avec logo récupérable -> image (repli sur le sigle si échec).
  if (isTeam && a.domain && !imgError) {
    return (
      <span className={`avatar avatar-logo${ring ? ' ring' : ''}`} title={a.label}
        style={{ width: size, height: size }}>
        <img src={`https://logo.clearbit.com/${a.domain}`} alt={a.label}
          loading="lazy" onError={() => setImgError(true)} />
      </span>
    )
  }

  // Repli : sigle (équipe) ou emoji (personnage).
  return (
    <span className={`avatar${ring ? ' ring' : ''}`} title={a.label}
      style={{
        background: a.color, width: size, height: size,
        fontSize: Math.round(size * (isTeam ? 0.34 : 0.52)),
        color: isTeam ? (a.fg || '#fff') : undefined,
        fontWeight: isTeam ? 800 : undefined,
        letterSpacing: isTeam ? '-.5px' : undefined,
      }}>
      {isTeam ? a.code : a.emoji}
    </span>
  )
}
