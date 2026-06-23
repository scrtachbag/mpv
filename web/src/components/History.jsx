import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { formatDateFr } from '../lib/time'
import { riderName } from '../lib/format'
import Avatar from './Avatar.jsx'

// Points qu'un coureur rapporte (hors bonus) : côte / place, ×2 si 1ᵉ, 0 hors top 10.
function basePoints(odds, position) {
  if (!odds || !position || position > 10) return 0
  return Math.round((odds / position) * (position === 1 ? 2 : 1) * 100) / 100
}

export default function History() {
  const { user } = useAuth()
  const [stages, setStages] = useState([])
  const [idx, setIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [loadingStage, setLoadingStage] = useState(false)

  // Étapes clôturées (deadline passée), de la plus récente à la plus ancienne.
  useEffect(() => {
    (async () => {
      const { data: st } = await supabase
        .from('stages')
        .select('id, stage_no, label, name, date, results_status, bet_deadline')
        .lt('bet_deadline', new Date().toISOString())
        .order('stage_no', { ascending: false })
      setStages(st ?? [])
      setLoading(false)
    })()
  }, [])

  // Détail de l'étape sélectionnée : top 10 + côtes + parieurs par coureur.
  useEffect(() => {
    const s = stages[idx]
    if (!s) { setData(null); return }
    let cancelled = false
    ;(async () => {
      setLoadingStage(true)
      const [{ data: results }, { data: riders }, { data: bets }, { data: profiles }] = await Promise.all([
        supabase.from('stage_results').select('position, rider_name').eq('stage_id', s.id).order('position').limit(10),
        supabase.from('stage_riders').select('rider_name, odds').eq('stage_id', s.id),
        supabase.from('bets').select('user_id, rider_name, bonus_used').eq('stage_id', s.id),
        supabase.from('profiles').select('id, pseudo, avatar'),
      ])
      if (cancelled) return
      const prof = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
      const oddsBy = {}
      for (const r of riders ?? []) oddsBy[r.rider_name.toLowerCase()] = Number(r.odds)
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
      const rows = (results ?? []).map((r) => {
        const odds = oddsBy[r.rider_name.toLowerCase()] ?? null
        return {
          position: r.position,
          rider: riderName(r.rider_name),
          odds,
          points: basePoints(odds, r.position),
          bettors: bettorsBy[r.rider_name.toLowerCase()] ?? [],
        }
      })
      setData({ rows, official: s.results_status === 'official' })
      setLoadingStage(false)
    })()
    return () => { cancelled = true }
  }, [idx, stages, user.id])

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

      {loadingStage || !data ? <p className="muted">Chargement…</p>
        : !data.official ? <p className="muted">Résultats en attente pour cette étape.</p>
        : data.rows.length === 0 ? <p className="muted">Aucun résultat enregistré.</p>
        : (
          <ul className="res-list">
            {data.rows.map((r) => (
              <li key={r.position} className={r.bettors.some((b) => b.isMe) ? 'mine' : ''}>
                <div className="res-head">
                  <span className="res-pos">{r.position}</span>
                  <span className="res-rider">{r.rider}</span>
                  <span className="res-odds">{r.odds ? r.odds.toFixed(2) : '—'}</span>
                  <span className="res-pts">{r.points.toFixed(2)}<small> pts</small></span>
                </div>
                <div className="res-bettors">
                  {r.bettors.length === 0
                    ? <span className="muted">personne</span>
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
        )}
      <p className="hist-count muted">Étape {stages.length - idx} / {stages.length}</p>
    </div>
  )
}
