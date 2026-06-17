// Helpers de date/heure, tout en heure de Paris pour la deadline des paris.

const PARIS = 'Europe/Paris'

// Date du jour à Paris au format "YYYY-MM-DD".
export function parisToday() {
  // 'en-CA' produit AAAA-MM-JJ.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

// Date lisible "lundi 6 juillet".
export function formatDateFr(isoDate) {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T12:00:00')
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS, weekday: 'long', day: 'numeric', month: 'long',
  }).format(d)
}

// Temps restant avant la deadline (ms). Négatif si dépassé.
export function msUntil(iso) {
  return new Date(iso).getTime() - Date.now()
}

// "2 h 14 min" à partir d'un nombre de ms.
export function formatCountdown(ms) {
  if (ms <= 0) return 'clôturé'
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m} min`
}
