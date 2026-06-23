// Avatars : soit un personnage (emoji), soit une équipe (sigle + couleur).
// `key` est stocké en base (profiles.avatar).

const CHARACTERS = [
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

// Équipes engagées sur le Tour (couleurs de marque approximatives).
const TEAMS = [
  { key: 'uae',        code: 'UAE', label: 'UAE Team Emirates',          color: '#1c1c1c' },
  { key: 'visma',      code: 'VIS', label: 'Visma | Lease a Bike',       color: '#fde047', fg: '#1b1c22' },
  { key: 'soudal',     code: 'SQS', label: 'Soudal Quick-Step',          color: '#0a1f8f' },
  { key: 'ineos',      code: 'INE', label: 'INEOS Grenadiers',           color: '#1e2a4a' },
  { key: 'lidltrek',   code: 'LTK', label: 'Lidl-Trek',                  color: '#d4002a' },
  { key: 'bora',       code: 'BOR', label: 'Red Bull–BORA–hansgrohe',    color: '#0e2148' },
  { key: 'bahrain',    code: 'BAH', label: 'Bahrain Victorious',         color: '#bd0029' },
  { key: 'fdj',        code: 'FDJ', label: 'Groupama-FDJ',               color: '#0050b5' },
  { key: 'decathlon',  code: 'DEC', label: 'Decathlon AG2R La Mondiale', color: '#0a1b6b' },
  { key: 'ef',         code: 'EF',  label: 'EF Education–EasyPost',      color: '#ff2e8b' },
  { key: 'movistar',   code: 'MOV', label: 'Movistar Team',              color: '#13205e' },
  { key: 'jayco',      code: 'JAY', label: 'Team Jayco AlUla',           color: '#10b0a4' },
  { key: 'intermarche',code: 'IWA', label: 'Intermarché–Wanty',         color: '#6b2c8f' },
  { key: 'cofidis',    code: 'COF', label: 'Cofidis',                    color: '#d6001c' },
  { key: 'astana',     code: 'AST', label: 'Astana Qazaqstan',          color: '#1fb6e6' },
  { key: 'alpecin',    code: 'ALP', label: 'Alpecin–Deceuninck',        color: '#e3007a' },
  { key: 'arkea',      code: 'ARK', label: 'Arkéa–B&B Hotels',          color: '#cf102d' },
  { key: 'israel',     code: 'IPT', label: 'Israel–Premier Tech',       color: '#f15a22' },
  { key: 'totalenergies', code: 'TOT', label: 'TotalEnergies',          color: '#1a3b8b' },
  { key: 'unox',       code: 'UNO', label: 'Uno-X Mobility',            color: '#e4002b' },
  { key: 'lotto',      code: 'LOT', label: 'Lotto',                      color: '#e2001a' },
]

export const AVATARS = [...CHARACTERS, ...TEAMS]
export const AVATAR_MAP = Object.fromEntries(AVATARS.map((a) => [a.key, a]))

export function avatarOf(key) {
  return AVATAR_MAP[key] || AVATAR_MAP.sprinteur
}

export function randomAvatarKey() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].key
}
