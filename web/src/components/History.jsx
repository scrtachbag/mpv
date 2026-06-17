import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'

export default function History() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: scores }, { data: stages }] = await Promise.all([
        supabase.from('bet_scores')
          .select('stage_id, rider_name, bonus_used, odds, position, points')
          .eq('user_id', user.id),
        supabase.from('stages').select('id, stage_no, label, date'),
      ])
      const byId = Object.fromEntries((stages ?? []).map((s) => [s.id, s]))
      const merged = (scores ?? [])
        .map((s) => ({ ...s, stage: byId[s.stage_id] }))
        .filter((s) => s.stage)
        .sort((a, b) => b.stage.stage_no - a.stage.stage_no)
      setRows(merged)
      setLoading(false)
    })()
  }, [user.id])

  if (loading) return <div className="card">Chargement…</div>

  const total = rows.reduce((s, r) => s + Number(r.points || 0), 0)

  return (
    <div className="card">
      <h2>Mon historique</h2>
      {rows.length === 0 ? (
        <p className="muted">Tu n’as encore aucun pari.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Étape</th><th>Mon coureur</th><th>Côte</th><th>Place</th><th>Points</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.stage_id}>
                <td>{r.stage.label}</td>
                <td>{r.rider_name}{r.bonus_used ? ' ⚡️' : ''}</td>
                <td className="num">{r.odds ? Number(r.odds).toFixed(2) : '—'}</td>
                <td className="num">{r.position ? `${r.position}ᵉ` : '—'}</td>
                <td className="num">{Number(r.points).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={4}>Total</td><td className="num">{total.toFixed(2)}</td></tr>
          </tfoot>
        </table>
      )}
    </div>
  )
}
