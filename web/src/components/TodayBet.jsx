import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { parisToday, formatDateFr, msUntil, formatCountdown } from '../lib/time'
import { riderName, sameRider } from '../lib/format'
import Avatar from './Avatar.jsx'
import Bonus from './Bonus.jsx'

export default function TodayBet() {
  const { user } = useAuth()
  const [stage, setStage] = useState(null)
  const [riders, setRiders] = useState([])
  const [myBet, setMyBet] = useState(null)
  const [bonusCount, setBonusCount] = useState(0)
  const [results, setResults] = useState([])
  const [othersBets, setOthersBets] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())

  // choix en cours
  const [rider, setRider] = useState('')
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
      const [{ data: rs }, { data: bet }, { data: res }] = await Promise.all([
        supabase.from('stage_riders').select('rider_name, odds')
          .eq('stage_id', st.id).order('odds', { ascending: true }),
        supabase.from('bets').select('*').eq('stage_id', st.id)
          .eq('user_id', user.id).maybeSingle(),
        supabase.from('stage_results').select('position, rider_name')
          .eq('stage_id', st.id).order('position', { ascending: true }),
      ])
      setRiders(rs ?? [])
      setMyBet(bet ?? null)
      setRider(bet?.rider_name ?? '')
      setBonus(bet?.bonus_used ?? false)
      setResults(res ?? [])

      // Pronostics des autres : visibles seulement après la deadline (RLS).
      if (msUntil(st.bet_deadline) <= 0) {
        const { data: others } = await supabase
          .from('bets').select('user_id, rider_name, bonus_used, profiles(pseudo, avatar)')
          .eq('stage_id', st.id)
        setOthersBets(others ?? [])
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

  // Score de mon pari une fois les résultats connus.
  let myOutcome = null
  if (resultsOfficial && myBet) {
    const r = results.find((x) => sameRider(x.rider_name, myBet.rider_name))
    myOutcome = r ? r.position : null
  }

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
          <div className={closed ? 'deadline closed' : 'deadline open'}>
            {closed ? 'Paris clôturés' : `⏳ ${formatCountdown(ms)} avant 12h00`}
          </div>
        </div>
      </div>

      {stage.odds_status !== 'published' ? (
        <div className="card"><p className="muted">Les côtes du jour ne sont pas encore publiées. Reviens un peu plus tard ce matin.</p></div>
      ) : (
        <div className="card">
          <h3>Ton pronostic</h3>
          {closed ? (
            <p className="muted">
              {myBet
                ? <>Tu avais misé sur <strong>{riderName(myBet.rider_name)}</strong>{myBet.bonus_used ? ' (bonus ×2)' : ''}.</>
                : 'Tu n’as pas parié sur cette étape.'}
            </p>
          ) : (
            <form onSubmit={submit}>
              <label htmlFor="rider">Coureur que tu vois gagner</label>
              <select id="rider" required value={rider} onChange={(e) => setRider(e.target.value)}>
                <option value="" disabled>— choisir un coureur —</option>
                {riders.map((r) => (
                  <option key={r.rider_name} value={r.rider_name}>
                    {riderName(r.rider_name)} — côte {Number(r.odds).toFixed(2)}
                  </option>
                ))}
              </select>

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
          )}
        </div>
      )}

      {resultsOfficial && (
        <div className="card">
          <h3>Résultat de l’étape</h3>
          <ol className="podium">
            {results.slice(0, 10).map((r) => (
              <li key={r.position} className={myBet && sameRider(myBet.rider_name, r.rider_name) ? 'mine' : ''}>
                <span className="pos">{r.position}</span> {riderName(r.rider_name)}
              </li>
            ))}
          </ol>
          {myBet && (
            <p className="muted">
              Ton coureur ({riderName(myBet.rider_name)}) :{' '}
              {myOutcome ? `${myOutcome}ᵉ` : 'hors du top 10'}.
            </p>
          )}
        </div>
      )}

      {closed && othersBets.length > 0 && (
        <div className="card">
          <h3>Pronostics du jour</h3>
          <ul className="picks">
            {othersBets.map((b) => (
              <li key={b.user_id}>
                <Avatar name={b.profiles?.avatar} size={26} />
                <strong>{b.profiles?.pseudo ?? '?'}</strong>
                {b.user_id === user.id ? ' (toi)' : ''} → {riderName(b.rider_name)}
                {b.bonus_used ? ' ⚡️' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
