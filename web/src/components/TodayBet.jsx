import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { parisToday, formatDateFr, msUntil, formatCountdown } from '../lib/time'
import { riderName, flag } from '../lib/format'
import Avatar from './Avatar.jsx'
import Bonus from './Bonus.jsx'
import TeamBadge from './TeamBadge.jsx'
import StageResults from './StageResults.jsx'

// Normalise pour une recherche insensible aux accents et à la casse.
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function TodayBet() {
  const { user } = useAuth()
  const [stage, setStage] = useState(null)
  const [riders, setRiders] = useState([])
  const [myBet, setMyBet] = useState(null)
  const [bonusCount, setBonusCount] = useState(0)
  const [othersBets, setOthersBets] = useState([])
  const [resultPos, setResultPos] = useState({})   // rider_name (min.) -> place finale
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())

  // choix en cours
  const [rider, setRider] = useState('')
  const [riderQuery, setRiderQuery] = useState('')
  const [bonus, setBonus] = useState(false)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const today = parisToday()
    const { data: st } = await supabase
      .from('stages').select('*').eq('date', today)
      .order('stage_no', { ascending: false }).limit(1).maybeSingle()
    setStage(st ?? null)

    if (st) {
      const [{ data: rs }, { data: bet }] = await Promise.all([
        supabase.from('stage_riders').select('rider_name, odds, nationality, team')
          .eq('stage_id', st.id).order('odds', { ascending: true }),
        supabase.from('bets').select('*').eq('stage_id', st.id)
          .eq('user_id', user.id).maybeSingle(),
      ])
      setRiders(rs ?? [])
      setMyBet(bet ?? null)
      setRider(bet?.rider_name ?? '')
      setBonus(bet?.bonus_used ?? false)

      // Pronostics des autres : visibles seulement après la deadline (RLS).
      if (msUntil(st.bet_deadline) <= 0) {
        const { data: others } = await supabase
          .from('bets').select('user_id, rider_name, bonus_used, profiles(pseudo, first_name, avatar)')
          .eq('stage_id', st.id)
        setOthersBets(others ?? [])
      }

      // Place finale de chaque coureur (pour l'afficher à côté des pronostics).
      if (st.results_status === 'official') {
        const { data: res } = await supabase
          .from('stage_results').select('position, rider_name').eq('stage_id', st.id)
        const map = {}
        for (const r of res ?? []) map[(r.rider_name || '').toLowerCase()] = r.position
        setResultPos(map)
      }
    }

    const { count } = await supabase
      .from('bets').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('bonus_used', true)
    setBonusCount(count ?? 0)
    setLoading(false)
  }, [user.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <div className="card">Chargement…</div>

  if (!stage) {
    return (
      <div className="card">
        <h2>Pas d’étape aujourd’hui 🛌</h2>
        <p className="muted">Jour de repos ou hors période du Tour. Reviens demain matin !</p>
      </div>
    )
  }

  const ms = msUntil(stage.bet_deadline)
  const closed = ms <= 0
  const bonusLeft = 2 - bonusCount
  const canUseBonus = bonusLeft > 0 || myBet?.bonus_used
  const resultsOfficial = stage.results_status === 'official'
  // Récap basé sur le pari VALIDÉ (myBet), pas sur la sélection en cours.
  const picked = myBet ? riders.find((r) => r.rider_name === myBet.rider_name) : null
  // Méta (drapeau/équipe/côte) par coureur, pour l'affichage des pronostics.
  const ridersByName = {}
  for (const r of riders) ridersByName[r.rider_name.toLowerCase()] = r
  // Liste filtrée par la recherche.
  const q = norm(riderQuery)
  const shown = q ? riders.filter((r) => norm(riderName(r.rider_name)).includes(q)) : riders

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('bets').upsert({
      user_id: user.id, stage_id: stage.id, rider_name: rider, bonus_used: bonus,
    }, { onConflict: 'user_id,stage_id' })
    setSaving(false)
    if (error) {
      setMsg({ type: 'error', text: error.message })
    } else {
      setMsg({ type: 'success', text: 'Pari enregistré ✅' })
      load()
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row spread">
          <div>
            <h2>{stage.label}{stage.name ? ` — ${stage.name}` : ''}</h2>
            <p className="muted">{formatDateFr(stage.date)}</p>
          </div>
          <div className={`deadline ${!closed ? 'open' : resultsOfficial ? 'done' : 'running'}`}>
            {!closed ? `⏳ ${formatCountdown(ms)} avant 12h00`
              : resultsOfficial ? '✅ Classement publié'
              : '🏁 Course en cours…'}
          </div>
        </div>
      </div>

      {stage.odds_status !== 'published' ? (
        <div className="card"><p className="muted">Les côtes du jour ne sont pas encore publiées. Reviens un peu plus tard ce matin.</p></div>
      ) : !closed ? (
        <div className="card">
          <div className="row spread" style={{ alignItems: 'center', gap: '.6rem' }}>
            <h3 style={{ margin: 0 }}>Ton pronostic</h3>
            {picked && (
              <span className="pick-chip">
                <span className="rp-flag">{flag(picked.nationality)}</span>
                <TeamBadge name={picked.team} size={20} />
                <strong>{riderName(picked.rider_name)}</strong>
                <span className="rp-odds">{Number(picked.odds).toFixed(2)}</span>
                {myBet?.bonus_used && <span title="Bonus ×2 activé">⚡️</span>}
              </span>
            )}
          </div>
            <form onSubmit={submit}>
              <label>Coureur que tu vois gagner</label>
              <input type="text" value={riderQuery} placeholder="🔍 Rechercher un coureur…"
                autoComplete="off" style={{ marginBottom: '.4rem' }}
                onChange={(e) => setRiderQuery(e.target.value)} />
              <div className="rider-pick">
                {shown.length === 0 && (
                  <div className="muted" style={{ padding: '.6rem .7rem' }}>Aucun coureur trouvé.</div>
                )}
                {shown.map((r) => (
                  <button type="button" key={r.rider_name}
                    className={`rider-row${rider === r.rider_name ? ' selected' : ''}`}
                    onClick={() => setRider(r.rider_name)}>
                    <span className="rp-flag">{flag(r.nationality)}</span>
                    <TeamBadge name={r.team} size={22} />
                    <span className="rp-name">{riderName(r.rider_name)}</span>
                    <span className="rp-odds">{Number(r.odds).toFixed(2)}</span>
                  </button>
                ))}
              </div>

              <label className={`checkbox ${!canUseBonus ? 'disabled' : ''}`}>
                <input type="checkbox" checked={bonus} disabled={!canUseBonus}
                  onChange={(e) => setBonus(e.target.checked)} />
                Utiliser un bonus ×2
                <Bonus remaining={bonusLeft} />
                <span className="muted">({bonusLeft}/2 restants)</span>
              </label>

              <button className="primary" disabled={saving || !rider}>
                {saving ? '…' : myBet ? 'Modifier mon pari' : 'Valider mon pari'}
              </button>
              {msg && <p className={msg.type}>{msg.text}</p>}
            </form>
        </div>
      ) : null}

      {resultsOfficial && (
        <div className="card">
          <h3>Résultat de l’étape</h3>
          <StageResults stageId={stage.id} />
        </div>
      )}

      {closed && othersBets.length > 0 && (
        <div className="card">
          <h3>Pronostics du jour</h3>
          <ul className="picks">
            {othersBets.map((b) => {
              const meta = ridersByName[(b.rider_name || '').toLowerCase()]
              const pos = resultPos[(b.rider_name || '').toLowerCase()]
              return (
                <li key={b.user_id} className={b.user_id === user.id ? 'mine' : ''}>
                  <Avatar name={b.profiles?.avatar} size={26} />
                  <strong title={b.profiles?.first_name || undefined}>{b.profiles?.pseudo ?? '?'}</strong>
                  <span className="muted">→</span>
                  <span className="rp-flag">{flag(meta?.nationality)}</span>
                  <TeamBadge name={meta?.team} size={18} />
                  <span>{riderName(b.rider_name)}</span>
                  {meta?.odds != null && (
                    <span className="rp-odds">{Number(meta.odds).toFixed(2)}</span>
                  )}
                  {b.bonus_used && <span title="Bonus ×2 activé">⚡️</span>}
                  {resultsOfficial && (
                    <span className="muted">{pos ? `— ${pos}ᵉ` : '— non classé'}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
