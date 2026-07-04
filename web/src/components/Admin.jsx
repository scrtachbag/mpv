import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Lien direct (facultatif) vers le workflow GitHub Actions, en repli si
// l'Edge Function n'est pas configurée.
const ACTIONS_URL = import.meta.env.VITE_MPV_ACTIONS_URL

export default function Admin() {
  const [stages, setStages] = useState([])
  const [busy, setBusy] = useState(null)   // stage_no en cours, ou 'today'
  const [msg, setMsg] = useState(null)
  const [reopenTime, setReopenTime] = useState('17:00')
  const [deadlineMsg, setDeadlineMsg] = useState(null)

  async function reopenBets() {
    setBusy('reopen'); setDeadlineMsg(null)
    const { error } = await supabase.rpc('admin_reopen_bets', { p_time: reopenTime })
    setBusy(null)
    if (error) setDeadlineMsg({ type: 'error', text: error.message })
    else { setDeadlineMsg({ type: 'success', text: `Paris rouverts jusqu'à ${reopenTime}.` }); load() }
  }

  async function closeBets() {
    setBusy('close'); setDeadlineMsg(null)
    const { error } = await supabase.rpc('admin_close_bets')
    setBusy(null)
    if (error) setDeadlineMsg({ type: 'error', text: error.message })
    else { setDeadlineMsg({ type: 'success', text: 'Paris fermés.' }); load() }
  }

  async function load() {
    const { data } = await supabase.from('stages')
      .select('*').order('stage_no', { ascending: false })
    setStages(data ?? [])
  }
  useEffect(() => { load() }, [])

  // Déclenche le workflow GitHub "Résultats du soir" via l'Edge Function.
  async function fetchResults(stageNo) {
    setBusy(stageNo ?? 'today'); setMsg(null)
    const { data, error } = await supabase.functions.invoke('trigger-results', {
      body: stageNo ? { stage_no: stageNo } : {},
    })
    setBusy(null)

    if (error) {
      let detail = error.message
      try { detail = (await error.context.json())?.error || detail } catch { /* noop */ }
      setMsg({ type: 'error', text: `Échec : ${detail}` })
    } else if (data?.ok) {
      setMsg({ type: 'success', text: '✅ Workflow déclenché — résultats récupérés dans 1–2 min, le classement se mettra à jour seul.' })
    } else {
      setMsg({ type: 'error', text: data?.error || 'Réponse inattendue.' })
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>⚙️ Administration</h2>
        <p className="muted">
          Le classement est recalculé <strong>en continu</strong> : dès que les résultats
          d’une étape sont en base, les points se mettent à jour automatiquement.
        </p>
        <p className="muted">
          Le bouton ci-dessous déclenche la récupération des résultats depuis
          ProCyclingStats (workflow GitHub « Résultats du soir »).
        </p>
        <button className="primary" style={{ width: 'auto' }}
          disabled={busy === 'today'} onClick={() => fetchResults(null)}>
          {busy === 'today' ? '…' : '↻ Récupérer les résultats du jour'}
        </button>
        {msg && <p className={msg.type}>{msg.text}</p>}
        {ACTIONS_URL && (
          <p className="muted" style={{ marginTop: '.6rem' }}>
            (Ou manuellement : <a href={ACTIONS_URL} target="_blank" rel="noreferrer">GitHub Actions → Run workflow</a>.)
          </p>
        )}
      </div>

      <div className="card">
        <h3>⏱️ Paris de l’étape du jour</h3>
        <p className="muted">
          Rouvrir ou fermer manuellement les paris — uniquement l’étape
          d’aujourd’hui, et seulement si les résultats ne sont pas encore officiels.
          N’affecte pas les étapes suivantes.
        </p>
        <div className="row" style={{ gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ margin: 0 }}>Rouvrir jusqu’à</label>
          <input type="time" value={reopenTime} style={{ width: 'auto' }}
            onChange={(e) => setReopenTime(e.target.value)} />
          <button className="primary" style={{ width: 'auto', margin: 0 }}
            disabled={busy === 'reopen'} onClick={reopenBets}>
            {busy === 'reopen' ? '…' : 'Rouvrir les paris'}
          </button>
          <button className="link" disabled={busy === 'close'} onClick={closeBets}>
            {busy === 'close' ? '…' : 'Fermer les paris maintenant'}
          </button>
        </div>
        {deadlineMsg && <p className={deadlineMsg.type}>{deadlineMsg.text}</p>}
      </div>

      <div className="card">
        <h3>Étapes</h3>
        <table className="table">
          <thead>
            <tr><th>Étape</th><th>Date</th><th>Côtes</th><th>Résultats</th><th></th></tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>{s.date}</td>
                <td>{s.odds_status === 'published' ? '✅' : '⏳'}</td>
                <td>{s.results_status === 'official' ? '✅' : '⏳'}</td>
                <td>
                  <button className="link" disabled={busy === s.stage_no}
                    onClick={() => fetchResults(s.stage_no)}>
                    {busy === s.stage_no ? '…' : '↻ résultats'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
