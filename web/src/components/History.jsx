import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { formatDateFr } from '../lib/time'
import Avatar from './Avatar.jsx'

export default function History() {
  const { user } = useAuth()
  const [stages, setStages] = useState([])
  const [byStage, setByStage] = useState({})
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: scores }, { data: profiles }, { data: stageRows }] = await Promise.all([
        supabase.from('bet_scores')
          .select('stage_id, user_id, rider_name, bonus_used, odds, position, points'),
        supabase.from('profiles').select('id, pseudo, avatar'),
        supabase.from('stages').select('id, stage_no, label, name, date, results_status, bet_deadline'),
      ])
      const prof = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))

      const grouped = {}
      for (const s of scores ?? []) {
        ;(grouped[s.stage_id] ??= []).push({
          ...s,
          pseudo: prof[s.user_id]?.pseudo ?? '?',
          avatar: prof[s.user_id]?.avatar,
          isMe: s.user_id === user.id,
        })
      }
      for (const id of Object.keys(grouped)) {
        grouped[id].sort((a, b) =>
          Number(b.points) - Number(a.points) || a.pseudo.localeCompare(b.pseudo))
      }
      // On n'affiche une étape dans l'historique qu'une fois sa deadline passée
      // (sinon on verrait son propre pari de l'étape du jour en cours).
      const now = Date.now()
      const visible = (stageRows ?? [])
        .filter((s) => grouped[s.id]?.length && new Date(s.bet_deadline).getTime() <= now)
        .sort((a, b) => b.stage_no - a.stage_no)

      setByStage(grouped)
      setStages(visible)
      setLoading(false)
    })()
  }, [user.id])

  if (loading) return <p className="muted">Chargement…</p>
  if (stages.length === 0) return <p className="muted">Aucun pari pour l’instant.</p>

  const s = stages[idx]
  const rows = byStage[s.id]

  return (
    <div className="hist">
      <div className="hist-nav">
        <button className="round" disabled={idx >= stages.length - 1}
          onClick={() => setIdx((i) => i + 1)}>‹</button>
        <div className="hist-title">
          <strong>{s.label}</strong>
          <span className="muted">{s.name ? `${s.name} · ` : ''}{formatDateFr(s.date)}</span>
          {s.results_status !== 'official' && <span className="badge-soft">en attente des résultats</span>}
        </div>
        <button className="round" disabled={idx <= 0}
          onClick={() => setIdx((i) => i - 1)}>›</button>
      </div>

      <ul className="hist-list">
        {rows.map((b) => (
          <li key={b.user_id} className={b.isMe ? 'me' : ''}>
            <Avatar name={b.avatar} size={30} />
            <span className="hl-name">{b.pseudo}{b.isMe ? ' (toi)' : ''}</span>
            <span className="hl-rider">{b.rider_name}{b.bonus_used ? ' ⚡️' : ''}</span>
            <span className="hl-place muted">{b.position ? `${b.position}ᵉ` : '—'}</span>
            <span className="hl-pts">{Number(b.points).toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <p className="hist-count muted">Étape {stages.length - idx} / {stages.length} affichée</p>
    </div>
  )
}
