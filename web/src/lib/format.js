// Affichage uniforme des noms de coureurs.
// PCS renvoie tantôt "VAN DER POEL Mathieu" (startlist), tantôt
// "van der Poel Mathieu" (résultats) -> on affiche partout en Title Case.
export function riderName(name) {
  if (!name) return ''
  return name.toLowerCase().replace(/(^|[\s'’-])([\p{L}])/gu, (_, sep, ch) => sep + ch.toUpperCase())
}

// Comparaison de noms insensible à la casse/espaces.
export function sameRider(a, b) {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
}

// Code pays ISO2 -> drapeau emoji ("fr" -> 🇫🇷). Renvoie '' si invalide.
export function flag(code) {
  const c = (code || '').trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return ''
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

// Nom d'équipe PCS -> clé d'avatar d'équipe (pour afficher le logo). null sinon.
const TEAM_MATCHERS = [
  [/uae/, 'uae'], [/visma/, 'visma'], [/quick.?step|soudal/, 'soudal'],
  [/ineos/, 'ineos'], [/lidl|trek/, 'lidltrek'], [/bora|red.?bull/, 'bora'],
  [/bahrain/, 'bahrain'], [/groupama|fdj/, 'fdj'], [/decathlon|ag2r/, 'decathlon'],
  [/ef education|easypost/, 'ef'], [/movistar/, 'movistar'], [/jayco|j. ?alula|alula/, 'jayco'],
  [/intermarch|wanty/, 'intermarche'], [/cofidis/, 'cofidis'], [/astana/, 'astana'],
  [/alpecin/, 'alpecin'], [/ark[ée]a/, 'arkea'], [/israel|premier.?tech/, 'israel'],
  [/totalenergies|total ?energies/, 'totalenergies'], [/uno.?x/, 'unox'], [/lotto/, 'lotto'],
]
export function teamKey(name) {
  const n = (name || '').toLowerCase()
  if (!n) return null
  for (const [re, key] of TEAM_MATCHERS) if (re.test(n)) return key
  return null
}
