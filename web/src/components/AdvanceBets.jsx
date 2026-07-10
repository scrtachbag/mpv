import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { formatDateFr } from '../lib/time'
import { riderName, flag } from '../lib/format'
import TeamBadge from './TeamBadge.jsx'

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const PROFILE_ICON = { flat: '🚴', hilly: '⛰️', mountain: '🏔️', itt: '⏱️' }

// Pré-choix : choisir un coureur pour une étape PAS ENCORE ouverte (odds_status
// 'pending', sans cote). À l'ouverture (la veille, cotes calibrées marché), le
// pré-choix devient un pari normal, ajustable jusqu'au départ.
export default function AdvanceBets() {
  const { user } = useAuth()
  const [stages, setStages] = useState([])
  const [riders, setRiders] = useState([])
  const [picks, setPicks] = useState({})        // stage_id -> { rider_name }
  const [openStage, setOpenStage] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const now = new Date().toISOString()
    const { data: st } = await supabase.from('stages').select('*')
      .eq('odds_status', 'pending').gt('bet_deadline', now)
      .order('date', { ascending: true })
    const list = st ?? []
    setStages(list)

    // Liste de coureurs (sans cote) = startlist de la dernière étape cotée.
    const { data: last } = await supabase.from('stages').select('id')
      .eq('odds_status', 'published').order('date', { ascending: false })
      .limit(1).maybeSingle()
    if (last) {
      const { data: rs } = await supabase.from('stage_riders')
        .select('rider_name, nationality, team').eq('stage_id', last.id)
        .order('rider_name', { ascending: true })
      setRiders(rs ?? [])
    }

    if (list.length) {
      const { data: bets } = await supabase.from('bets')
        .select('stage_id, rider_name').eq('user_id', user.id)
        .in('stage_id', list.map((s) => s.id))
      const m = {}
      for (const b of bets ?? []) m[b.stage_id] = b
      setPicks(m)
    }
    setLoading(false)
  }, [user.id])

  useEffect(() => { load() }, [load])

  async function choose(stage, rider_name) {
    setSaving(true)
    await supabase.from('bets').upsert(
      { user_id: user.id, stage_id: stage.id, rider_name },
      { onConflict: 'user_id,stage_id' },
    )
    setSaving(false)
    setOpenStage(null); setQuery('')
    load()
  }

  if (loading || stages.length === 0) return null

  const q = norm(query)
  const shown = q ? riders.filter((r) => norm(riderName(r.rider_name)).includes(q)) : riders

  return (
    <div className="card">
      <h2>🔮 Paris à l’avance</h2>
      <p className="muted">
        Choisis ton coureur pour les étapes à venir. La cote sera figée à l’ouverture
        (la veille) ; tu pourras encore ajuster jusqu’au départ.
      </p>
      <ul className="adv-list">
        {stages.map((s) => {
          const mine = picks[s.id]
          const meta = mine ? riders.find((r) => r.rider_name === mine.rider_name) : null
          const isOpen = openStage === s.id
          return (
            <li key={s.id} className="adv-stage">
              <button className="adv-head" onClick={() => { setOpenStage(isOpen ? null : s.id); setQuery('') }}>
                <span className="adv-info">
                  <strong>{PROFILE_ICON[s.profile_type] || '🚴'} {s.label}</strong>
                  {s.name ? <span className="muted"> — {s.name}</span> : null}
                  <span className="muted adv-date">{formatDateFr(s.date)}</span>
                </span>
                <span className="adv-pick">
                  {mine ? (
                    <>
                      <span className="rp-flag">{flag(meta?.nationality)}</span>
                      {meta && <TeamBadge name={meta.team} size={18} />}
                      <strong>{riderName(mine.rider_name)}</strong>
                    </>
                  ) : <span className="muted">à choisir ▾</span>}
                </span>
              </button>
              {isOpen && (
                <div className="adv-picker">
                  <input type="text" value={query} placeholder="🔍 Rechercher un coureur…"
                    autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
                  <div className="rider-pick">
                    {shown.length === 0 && <div className="muted" style={{ padding: '.6rem .7rem' }}>Aucun coureur.</div>}
                    {shown.map((r) => (
                      <button type="button" key={r.rider_name} disabled={saving}
                        className={`rider-row${mine?.rider_name === r.rider_name ? ' selected' : ''}`}
                        onClick={() => choose(s, r.rider_name)}>
                        <span className="rp-flag">{flag(r.nationality)}</span>
                        <TeamBadge name={r.team} size={22} />
                        <span className="rp-name">{riderName(r.rider_name)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
