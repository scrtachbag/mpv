// Avatars de profil : personnages emoji (thème Tour de France).
// key est stocké en base (profiles.avatar).
export const AVATARS = [
  { key: 'jaune',       emoji: '🟡', label: 'Maillot Jaune',        color: '#f7d417' },
  { key: 'sprinteur',   emoji: '🚴', label: 'Le Sprinteur',         color: '#22c55e' },
  { key: 'grimpeur',    emoji: '⛰️', label: 'Le Grimpeur',          color: '#ef4444' },
  { key: 'rouleur',     emoji: '⏱️', label: 'Le Rouleur',           color: '#3b82f6' },
  { key: 'baroudeur',   emoji: '🦅', label: 'Le Baroudeur',         color: '#8b5cf6' },
  { key: 'ds',          emoji: '🚗', label: 'Le Directeur Sportif', color: '#0ea5e9' },
  { key: 'domestique',  emoji: '💧', label: 'Le Porteur de bidons', color: '#14b8a6' },
  { key: 'supporter',   emoji: '📣', label: 'Le Supporter',         color: '#f97316' },
  { key: 'caravane',    emoji: '🎪', label: 'La Caravane',          color: '#ec4899' },
  { key: 'diable',      emoji: '😈', label: 'Didi le Diable',       color: '#b91c1c' },
  { key: 'vache',       emoji: '🐄', label: 'La Vache du bord de route', color: '#84cc16' },
  { key: 'frites',      emoji: '🍟', label: 'Le Stand de Frites',   color: '#eab308' },
  { key: 'gendarme',    emoji: '🚓', label: 'Le Gendarme',          color: '#1d4ed8' },
  { key: 'photographe', emoji: '📸', label: 'Le Photographe moto',  color: '#64748b' },
]

export const AVATAR_MAP = Object.fromEntries(AVATARS.map((a) => [a.key, a]))

export function avatarOf(key) {
  return AVATAR_MAP[key] || AVATAR_MAP.sprinteur
}

export function randomAvatarKey() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].key
}
