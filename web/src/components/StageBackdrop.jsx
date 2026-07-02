import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { parisToday } from '../lib/time'

// "Départ → Arrivée" -> { from, to }. Sépare sur → (ou | pour la prévisualisation).
function parseCities(name) {
  if (!name) return null
  const [from, to] = String(name).split(/→|\|/).map((s) => s.replace(/\(.*\)/, '').trim())
  if (!from) return null
  return { from, to: to && to !== from ? to : '' }
}

// Filigrane des villes de l'étape du jour (départ + arrivée), en fond.
// Prévisualisation sans bêta : ?bg=Départ → Arrivée  (ou ?bg=Départ|Arrivée).
export default function StageBackdrop() {
  const [cities, setCities] = useState(null)

  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('bg')
    if (forced) { setCities(parseCities(forced)); return }
    supabase.from('stages').select('name').eq('date', parisToday())
      .order('stage_no', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setCities(parseCities(data?.name)))
      .catch(() => {})
  }, [])

  if (!cities) return null
  return (
    <div className="stage-bg" aria-hidden="true">
      <div className="stage-bg-inner">
        <span className="sb-city">{cities.from}</span>
        {cities.to && <span className="sb-arrow">↓</span>}
        {cities.to && <span className="sb-city">{cities.to}</span>}
      </div>
    </div>
  )
}
