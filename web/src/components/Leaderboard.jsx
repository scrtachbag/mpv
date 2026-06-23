import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import Avatar from './Avatar.jsx'
import Bonus from './Bonus.jsx'

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

  return (
    <ol className="lb">
      {rows.map((r, i) => (
        <li key={r.user_id}
          className={`lb-row${r.pseudo === profile?.pseudo ? ' me' : ''}${i === 0 ? ' leader' : ''}`}>
          <span className="lb-rank">{MEDALS[i] ?? i + 1}</span>
          <Avatar name={r.avatar} size={34} />
          <span className="lb-name">{r.pseudo}</span>
          <Bonus remaining={2 - Number(r.bonus_used || 0)} />
          <span className="lb-pts">{Number(r.total_points).toFixed(2)}<small> pts</small></span>
        </li>
      ))}
    </ol>
  )
}
