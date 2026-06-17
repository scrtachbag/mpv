import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'

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

  if (loading) return <div className="card">Chargement…</div>

  return (
    <div className="card">
      <h2>Classement général</h2>
      {rows.length === 0 ? (
        <p className="muted">Aucun point marqué pour l’instant.</p>
      ) : (
        <table className="table">
          <thead>
            <tr><th>#</th><th>Parieur</th><th>Points</th><th>Étapes</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.user_id} className={r.pseudo === profile?.pseudo ? 'me' : ''}>
                <td>{i + 1}</td>
                <td>{r.pseudo}</td>
                <td className="num">{Number(r.total_points).toFixed(2)}</td>
                <td className="num muted">{r.scored_stages}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
