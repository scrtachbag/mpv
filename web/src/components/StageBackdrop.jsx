import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { parisToday } from '../lib/time'

// Ville d'arrivée = ce qui suit la flèche dans "Départ → Arrivée".
function arrivalCity(name) {
  if (!name) return ''
  const parts = String(name).split('→')
  return (parts[1] || parts[0]).replace(/\(.*\)/, '').trim()
}

// Filigrane du nom de la ville d'arrivée du jour (desktop uniquement, cf. CSS).
// Prévisualisation sans bêta : ajoute ?bg=NomDeVille à l'URL pour forcer le nom.
export default function StageBackdrop() {
  const [city, setCity] = useState('')

  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('bg')
    if (forced) { setCity(forced); return }
    supabase.from('stages').select('name').eq('date', parisToday())
      .order('stage_no', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setCity(arrivalCity(data?.name)))
      .catch(() => {})
  }, [])

  if (!city) return null
  return <div className="stage-bg" aria-hidden="true"><span>{city}</span></div>
}
