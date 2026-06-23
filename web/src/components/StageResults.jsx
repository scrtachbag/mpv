import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { riderName, flag } from '../lib/format'
import Avatar from './Avatar.jsx'
import TeamBadge from './TeamBadge.jsx'

// Points qu'un coureur rapporte (hors bonus) : côte / place, ×2 si 1ᵉ, 0 hors top 10.
function basePoints(odds, position) {
  if (!odds || !position || position > 10) return 0
  return Math.round((odds / position) * (position === 1 ? 2 : 1) * 100) / 100
}

// Top 10 d'une étape : place, drapeau, équipe, côte, points rapportés, parieurs.
// Réutilisé par l'historique et par la course du jour.
export default function StageResults({ stageId }) {
  const { user } = useAuth()
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!stageId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [{ data: results }, { data: riders }, { data: bets }, { data: profiles }] = await Promise.all([
        supabase.from('stage_results').select('position, rider_name').eq('stage_id', stageId).order('position').limit(10),
        supabase.from('stage_riders').select('rider_name, odds, nationality, team').eq('stage_id', stageId),
        supabase.from('bets').select('user_id, rider_name, bonus_used').eq('stage_id', stageId),
        supabase.from('profiles').select('id, pseudo, avatar'),
      ])
      if (cancelled) return
      const prof = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
      const metaBy = {}
      for (const r of riders ?? []) {
        metaBy[r.rider_name.toLowerCase()] = { odds: Number(r.odds), nationality: r.nationality, team: r.team }
      }
      const bettorsBy = {}
      for (const b of bets ?? []) {
        const k = (b.rider_name || '').toLowerCase()
        ;(bettorsBy[k] ??= []).push({
          pseudo: prof[b.user_id]?.pseudo ?? '?',
          avatar: prof[b.user_id]?.avatar,
          bonus_used: b.bonus_used,
          isMe: b.user_id === user.id,
        })
      }
      setRows((results ?? []).map((r) => {
        const m = metaBy[r.rider_name.toLowerCase()] || {}
        const odds = m.odds ?? null
        return {
          position: r.position,
          rider: riderName(r.rider_name),
          nationality: m.nationality,
          team: m.team,
          odds,
          points: basePoints(odds, r.position),
          bettors: bettorsBy[r.rider_name.toLowerCase()] ?? [],
        }
      }))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [stageId, user.id])

  if (loading) return <p className="muted">Chargement…</p>
  if (!rows || rows.length === 0) return <p className="muted">Résultats en attente.</p>

  return (
    <ul className="res-list">
      {rows.map((r) => (
        <li key={r.position} className={r.bettors.some((b) => b.isMe) ? 'mine' : ''}>
          <div className="res-head">
            <span className="res-pos">{r.position}</span>
            <span className="rp-flag">{flag(r.nationality)}</span>
            <TeamBadge name={r.team} size={20} />
            <span className="res-rider">{r.rider}</span>
            <span className="res-odds">{r.odds ? r.odds.toFixed(2) : '—'}</span>
            <span className="res-pts">{r.points.toFixed(2)}<small> pts</small></span>
          </div>
          <div className="res-bettors">
            {r.bettors.length === 0
              ? null
              : r.bettors.map((b, i) => (
                <span key={i} className={`bettor${b.isMe ? ' me' : ''}`}>
                  <Avatar name={b.avatar} size={20} />
                  {b.pseudo}{b.bonus_used ? ' ⚡' : ''}
                </span>
              ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
