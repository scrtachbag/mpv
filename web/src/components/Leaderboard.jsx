import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import Avatar from './Avatar.jsx'

const MEDALS = ['🟡', '🥈', '🥉']  // maillot jaune pour le leader

export default function Leaderboard() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('get_leaderboard').then(({ data }) => {
      setRows(data ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="muted">Chargement…</p>
  if (rows.length === 0) return <p className="muted">Aucun point marqué pour l’instant.</p>

  // Lanterne rouge : le dernier, seulement s'il y a un écart réel (pas si tout
  // le monde est à égalité / à 0).
  const lastIdx = rows.length - 1
  const hasSpread = rows.length > 1 &&
    Number(rows[lastIdx].total_points) < Number(rows[0].total_points)

  return (
    <ol className="lb">
      {rows.map((r, i) => (
        <li key={r.user_id}
          className={`lb-row${r.pseudo === profile?.pseudo ? ' me' : ''}${i === 0 ? ' leader' : ''}`}>
          <span className="lb-rank">{MEDALS[i] ?? i + 1}</span>
          <Avatar name={r.avatar} size={34} />
          <span className="lb-name">
            {r.pseudo}
            {i === lastIdx && hasSpread && (
              <span title="Lanterne rouge 💩" style={{ marginLeft: '.35rem' }}>💩</span>
            )}
          </span>
          <span className="lb-bonus" title={`${Number(r.bonus_used || 0)} bonus utilisé(s) sur 2`}>
            {'⚡'.repeat(Number(r.bonus_used || 0))}
          </span>
          <span className="lb-pts">{Number(r.total_points).toFixed(2)}<small> pts</small></span>
        </li>
      ))}
    </ol>
  )
}
