// Avatars de profil : personnages emoji (thème vélo / Tour / pari / fun).
// key est stocké en base (profiles.avatar).
export const AVATARS = [
  // — Cyclisme & Tour —
  { key: 'jaune',       emoji: '🟡', label: 'Maillot Jaune',        color: '#f7d417' },
  { key: 'maillot_vert',emoji: '🟢', label: 'Maillot Vert',         color: '#16a34a' },
  { key: 'maillot_pois',emoji: '🔴', label: 'Maillot à Pois',       color: '#dc2626' },
  { key: 'maillot_blanc',emoji: '⚪', label: 'Maillot Blanc',        color: '#9aa3af' },
  { key: 'sprinteur',   emoji: '🚴', label: 'Le Sprinteur',         color: '#22c55e' },
  { key: 'grimpeur',    emoji: '⛰️', label: 'Le Grimpeur',          color: '#ef4444' },
  { key: 'sommet',      emoji: '🏔️', label: 'Le Sommet',            color: '#475569' },
  { key: 'rouleur',     emoji: '⏱️', label: 'Le Rouleur',           color: '#3b82f6' },
  { key: 'baroudeur',   emoji: '🦅', label: 'Le Baroudeur',         color: '#8b5cf6' },
  { key: 'velo',        emoji: '🚲', label: 'Le Biclou',            color: '#0ea5e9' },
  { key: 'casque',      emoji: '⛑️', label: 'Le Casque',            color: '#f59e0b' },
  { key: 'ds',          emoji: '🚗', label: 'Le Directeur Sportif', color: '#0ea5e9' },
  { key: 'domestique',  emoji: '💧', label: 'Le Porteur de bidons', color: '#14b8a6' },
  { key: 'mecano',      emoji: '🔧', label: 'Le Mécano',            color: '#6b7280' },
  { key: 'moto',        emoji: '🏍️', label: 'La Moto Ouvreuse',     color: '#1f2937' },
  { key: 'balai',       emoji: '🚐', label: 'La Voiture Balai',     color: '#6b7280' },
  { key: 'helico',      emoji: '🚁', label: 'L’Hélico TV',          color: '#475569' },
  { key: 'arrivee',     emoji: '🏁', label: 'La Ligne d’Arrivée',   color: '#111827' },

  // — Bord de route —
  { key: 'supporter',   emoji: '📣', label: 'Le Supporter',         color: '#f97316' },
  { key: 'caravane',    emoji: '🎪', label: 'La Caravane',          color: '#ec4899' },
  { key: 'diable',      emoji: '😈', label: 'Didi le Diable',       color: '#b91c1c' },
  { key: 'vache',       emoji: '🐄', label: 'La Vache du bord de route', color: '#84cc16' },
  { key: 'gendarme',    emoji: '🚓', label: 'Le Gendarme',          color: '#1d4ed8' },
  { key: 'photographe', emoji: '📸', label: 'Le Photographe moto',  color: '#64748b' },
  { key: 'tournesol',   emoji: '🌻', label: 'Le Champ de Tournesols', color: '#eab308' },
  { key: 'cagnard',     emoji: '☀️', label: 'Le Cagnard',           color: '#f59e0b' },
  { key: 'pluie',       emoji: '🌧️', label: 'Sous la Flotte',       color: '#0ea5e9' },
  { key: 'vent',        emoji: '🌬️', label: 'Le Vent de Face',      color: '#60a5fa' },

  // — Casse-croûte —
  { key: 'banane',      emoji: '🍌', label: 'La Banane',            color: '#facc15' },
  { key: 'bidon',       emoji: '🥤', label: 'Le Bidon',             color: '#22d3ee' },
  { key: 'cafe',        emoji: '☕', label: 'Le Petit Noir',        color: '#6f4e37' },
  { key: 'biere',       emoji: '🍺', label: 'La Binouze',           color: '#d97706' },
  { key: 'baguette',    emoji: '🥖', label: 'La Baguette',          color: '#d4a017' },
  { key: 'croissant',   emoji: '🥐', label: 'Le Croissant',         color: '#c2842a' },
  { key: 'fromage',     emoji: '🧀', label: 'Le Fromage',           color: '#f59e0b' },
  { key: 'frites',      emoji: '🍟', label: 'Le Stand de Frites',   color: '#eab308' },
  { key: 'pinard',      emoji: '🍷', label: 'Le Pinard',            color: '#7f1d1d' },

  // — Récompenses & gloire —
  { key: 'trophee',     emoji: '🏆', label: 'Le Trophée',           color: '#eab308' },
  { key: 'medaille',    emoji: '🥇', label: 'La Médaille d’Or',     color: '#f59e0b' },
  { key: 'podium',      emoji: '🏅', label: 'Le Podium',            color: '#d97706' },
  { key: 'champagne',   emoji: '🍾', label: 'Le Champagne',         color: '#15803d' },
  { key: 'feu_artifice',emoji: '🎆', label: 'Le Feu d’Artifice',    color: '#7c3aed' },
  { key: 'roi',         emoji: '👑', label: 'Le Roi de la Montagne',color: '#ca8a04' },

  // — Pari & chance —
  { key: 'des',         emoji: '🎲', label: 'Les Dés',              color: '#e11d48' },
  { key: 'trefle',      emoji: '🍀', label: 'Le Porte-Bonheur',     color: '#22c55e' },
  { key: 'magot',       emoji: '💰', label: 'Le Magot',             color: '#ca8a04' },
  { key: 'jackpot',     emoji: '🎰', label: 'Le Jackpot',           color: '#be123c' },
  { key: 'cible',       emoji: '🎯', label: 'Dans le Mille',        color: '#ef4444' },
  { key: 'joker',       emoji: '🃏', label: 'Le Joker',             color: '#7c3aed' },
  { key: 'groslot',     emoji: '💎', label: 'Le Gros Lot',          color: '#06b6d4' },
  { key: 'boule',       emoji: '🎱', label: 'La Boule de Cristal',  color: '#111827' },

  // — Bestiaire du peloton —
  { key: 'guepard',     emoji: '🐆', label: 'Le Guépard',           color: '#d97706' },
  { key: 'lievre',      emoji: '🐇', label: 'Le Lièvre',            color: '#9aa3af' },
  { key: 'tortue',      emoji: '🐢', label: 'La Lanterne Rouge',    color: '#65a30d' },
  { key: 'coq',         emoji: '🐓', label: 'Le Coq',               color: '#dc2626' },
  { key: 'requin',      emoji: '🦈', label: 'Le Requin',            color: '#0891b2' },
  { key: 'renard',      emoji: '🦊', label: 'Le Renard',            color: '#ea580c' },
  { key: 'lion',        emoji: '🦁', label: 'Le Lion',              color: '#d97706' },
  { key: 'chevre',      emoji: '🐐', label: 'La Chèvre (le G.O.A.T.)', color: '#78716c' },
  { key: 'kangourou',   emoji: '🦘', label: 'Le Kangourou',         color: '#b45309' },
  { key: 'tigre',       emoji: '🐅', label: 'Le Tigre',             color: '#ea580c' },

  // — Fun & loufoque —
  { key: 'feu',         emoji: '🔥', label: 'En Feu',               color: '#ef4444' },
  { key: 'eclair',      emoji: '⚡', label: 'L’Éclair',             color: '#facc15' },
  { key: 'fusee',       emoji: '🚀', label: 'La Fusée',             color: '#4338ca' },
  { key: 'faucheuse',   emoji: '💀', label: 'La Faucheuse',         color: '#374151' },
  { key: 'licorne',     emoji: '🦄', label: 'La Licorne',           color: '#ec4899' },
  { key: 'robot',       emoji: '🤖', label: 'Le Robot',             color: '#64748b' },
  { key: 'fantome',     emoji: '👻', label: 'Le Fantôme',           color: '#94a3b8' },
  { key: 'ninja',       emoji: '🥷', label: 'Le Ninja',             color: '#1f2937' },
  { key: 'dragon',      emoji: '🐉', label: 'Le Dragon',            color: '#16a34a' },
  { key: 'alien',       emoji: '👽', label: 'L’Extraterrestre',     color: '#22c55e' },
  { key: 'clown',       emoji: '🤡', label: 'Le Clown',             color: '#ef4444' },
  { key: 'pirate',      emoji: '🏴‍☠️', label: 'Le Pirate',          color: '#111827' },
  { key: 'magicien',    emoji: '🧙', label: 'Le Magicien',          color: '#7c3aed' },
]

export const AVATAR_MAP = Object.fromEntries(AVATARS.map((a) => [a.key, a]))

export function avatarOf(key) {
  return AVATAR_MAP[key] || AVATAR_MAP.sprinteur
}

export function randomAvatarKey() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].key
}
