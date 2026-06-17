import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// Lien vers le workflow "Résultats du soir" sur GitHub Actions (facultatif).
// Ex : https://github.com/<user>/mon-petit-velo/actions/workflows/results.yml
// On ne déclenche PAS depuis le navigateur : un token GitHub n'a rien à faire
// dans un bundle public. L'admin lance le workflow d'un clic ("Run workflow").
const ACTIONS_URL = import.meta.env.VITE_MPV_ACTIONS_URL

export default function Admin() {
  const [stages, setStages] = useState([])

  async function load() {
    const { data } = await supabase.from('stages')
      .select('*').order('stage_no', { ascending: false })
    setStages(data ?? [])
  }
  useEffect(() => { load() }, [])

  return (
    <div className="stack">
      <div className="card">
        <h2>Administration</h2>
        <p className="muted">
          Le classement est recalculé en continu : dès que les résultats d’une
          étape sont enregistrés, les points se mettent à jour automatiquement.
        </p>
        <p>
          Pour forcer la récupération des résultats à la demande, lance le
          workflow <strong>« Résultats du soir »</strong>
          {ACTIONS_URL ? (
            <> : <a href={ACTIONS_URL} target="_blank" rel="noreferrer">ouvrir GitHub Actions</a>{' '}
              → bouton <em>Run workflow</em> (laisse le numéro d’étape vide pour l’étape du jour).</>
          ) : (
            <> depuis <em>GitHub → onglet Actions → Résultats du soir → Run workflow</em>.</>
          )}
        </p>
      </div>

      <div className="card">
        <h3>Étapes</h3>
        <table className="table">
          <thead>
            <tr><th>#</th><th>Date</th><th>Côtes</th><th>Résultats</th></tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>{s.date}</td>
                <td>{s.odds_status === 'published' ? '✅' : '⏳'}</td>
                <td>{s.results_status === 'official' ? '✅' : '⏳'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
