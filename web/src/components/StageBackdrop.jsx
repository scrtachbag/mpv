import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { parisToday } from '../lib/time'

function label(name) {
  if (!name) return ''
  const [from, to] = String(name).split(/→|\|/).map((s) => s.replace(/\(.*\)/, '').trim())
  if (!from) return ''
  return to && to !== from ? `${from} → ${to}` : from
}

// Tuile SVG : le texte écrit deux fois, la 2e décalée d'une demi-largeur, pour
// obtenir un motif « brique » (décalage horizontal une ligne sur deux) quand on
// répète l'image en fond.
function tileUri(text, fs = 24) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const tw = Math.ceil(text.length * fs * 0.58)   // largeur approx. du texte
  const W = tw * 2 + 56
  const H = 84
  const t = (x, y) => `<text x='${x}' y='${y}' font-family='sans-serif' font-weight='700' `
    + `font-size='${fs}' fill='#1b1c22' fill-opacity='0.06'>${esc}</text>`
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>`
    + t(0, 30) + t(Math.round(W / 2), 72) + `</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// Filigrane tapissé (mobile + desktop). Preview sans bêta : ?bg=Départ → Arrivée.
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
      <div className="stage-bg-tiles" style={{ backgroundImage: `url("${tileUri(text)}")` }} />
    </div>
  )
}
