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
