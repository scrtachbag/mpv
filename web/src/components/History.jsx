import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { formatDateFr } from '../lib/time'
import StageResults from './StageResults.jsx'

export default function History() {
  const [stages, setStages] = useState([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  // Étapes clôturées (deadline passée), de la plus récente à la plus ancienne.
  useEffect(() => {
    (async () => {
      const { data: st } = await supabase
        .from('stages')
        .select('id, stage_no, label, name, date, bet_deadline')
        .lt('bet_deadline', new Date().toISOString())
        .order('stage_no', { ascending: false })
      setStages(st ?? [])
      setLoading(false)
    })()
  }, [])

  if (loading) return <p className="muted">Chargement…</p>
  if (stages.length === 0) return <p className="muted">Aucune étape clôturée pour l’instant.</p>

  const s = stages[idx]

  return (
    <div className="hist">
      <div className="hist-nav">
        <button className="round" disabled={idx >= stages.length - 1} onClick={() => setIdx((i) => i + 1)}>‹</button>
        <div className="hist-title">
          <strong>{s.label}</strong>
          <span className="muted">{s.name ? `${s.name} · ` : ''}{formatDateFr(s.date)}</span>
        </div>
        <button className="round" disabled={idx <= 0} onClick={() => setIdx((i) => i - 1)}>›</button>
      </div>

      <StageResults stageId={s.id} />

      <p className="hist-count muted">Étape {stages.length - idx} / {stages.length}</p>
    </div>
  )
}
