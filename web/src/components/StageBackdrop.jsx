import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { parisToday } from '../lib/time'

// "Départ → Arrivée" -> "Départ → Arrivée" nettoyé (sépare aussi sur | en preview).
function label(name) {
  if (!name) return ''
  const [from, to] = String(name).split(/→|\|/).map((s) => s.replace(/\(.*\)/, '').trim())
  if (!from) return ''
  return to && to !== from ? `${from} → ${to}` : from
}

// Filigrane tapissé : le nom de l'étape écrit en petit et répété en fond.
// Prévisualisation sans bêta : ?bg=Départ → Arrivée  (ou ?bg=Départ|Arrivée).
export default function StageBackdrop() {
  const [text, setText] = useState('')

  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get('bg')
    if (forced) { setText(label(forced)); return }
    supabase.from('stages').select('name').eq('date', parisToday())
      .order('stage_no', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setText(label(data?.name)))
      .catch(() => {})
  }, [])

  if (!text) return null
  return (
    <div className="stage-bg" aria-hidden="true">
      <div className="stage-bg-tiles">
        {Array.from({ length: 300 }, (_, i) => <span key={i}>{text}</span>)}
      </div>
    </div>
  )
}
