import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { formatDateFr } from '../lib/time'

export default function History() {
  const { user } = useAuth()
  const [stages, setStages] = useState([])
  const [byStage, setByStage] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: scores }, { data: profiles }, { data: stageRows }] = await Promise.all([
        // RLS : on voit ses propres paris toujours, et ceux des autres
        // seulement pour les étapes dont la deadline est passée.
        supabase.from('bet_scores')
          .select('stage_id, user_id, rider_name, bonus_used, odds, position, points'),
        supabase.from('profiles').select('id, pseudo'),
        supabase.from('stages').select('id, stage_no, label, name, date, results_status'),
      ])
      const pseudoOf = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.pseudo]))

      const grouped = {}
      for (const s of scores ?? []) {
        ;(grouped[s.stage_id] ??= []).push({
          ...s,
          pseudo: pseudoOf[s.user_id] ?? '?',
          isMe: s.user_id === user.id,
        })
      }
      for (const id of Object.keys(grouped)) {
        grouped[id].sort((a, b) =>
          Number(b.points) - Number(a.points) || a.pseudo.localeCompare(b.pseudo))
      }
      // On ne garde que les étapes ayant au moins un pari visible.
      const visible = (stageRows ?? [])
        .filter((s) => grouped[s.id]?.length)
        .sort((a, b) => b.stage_no - a.stage_no)

      setByStage(grouped)
      setStages(visible)
      setLoading(false)
    })()
  }, [user.id])

  if (loading) return <div className="card">Chargement…</div>
  if (stages.length === 0) {
    return <div className="card"><h2>Historique</h2><p className="muted">Aucun pari pour l’instant.</p></div>
  }

  return (
    <div className="stack">
      {stages.map((s) => (
        <div key={s.id} className="card">
          <div className="row spread">
            <h3>{s.label}{s.name ? ` — ${s.name}` : ''}</h3>
            <span className="muted">{formatDateFr(s.date)}</span>
          </div>
          {s.results_status !== 'official' && (
            <p className="muted">Résultats non encore officiels — points provisoires à 0.</p>
          )}
          <table className="table">
            <thead>
              <tr><th>Joueur</th><th>Coureur</th><th>Côte</th><th>Place</th><th>Points</th></tr>
            </thead>
            <tbody>
              {byStage[s.id].map((b) => (
                <tr key={b.user_id} className={b.isMe ? 'me' : ''}>
                  <td>{b.pseudo}{b.isMe ? ' (toi)' : ''}</td>
                  <td>{b.rider_name}{b.bonus_used ? ' ⚡️' : ''}</td>
                  <td className="num">{b.odds ? Number(b.odds).toFixed(2) : '—'}</td>
                  <td className="num">{b.position ? `${b.position}ᵉ` : '—'}</td>
                  <td className="num">{Number(b.points).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
