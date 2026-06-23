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
