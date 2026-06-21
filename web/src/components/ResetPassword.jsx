import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'

// Affiché quand l'utilisateur arrive via un lien "mot de passe oublié".
// La session de récupération autorise updateUser({ password }).
export default function ResetPassword() {
  const { clearRecovery, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else clearRecovery()   // session + profil déjà présents → on entre dans l'appli
  }

  return (
    <div className="card narrow">
      <h1>Nouveau mot de passe</h1>
      <p className="muted">Choisis un nouveau mot de passe pour ton compte.</p>
      <form onSubmit={submit}>
        <label htmlFor="password">Mot de passe</label>
        <input id="password" type="password" required minLength={6} value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)} placeholder="•••••• (6 caractères min.)" />
        <button className="primary" disabled={busy}>
          {busy ? '…' : 'Mettre à jour'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      <p className="muted" style={{ marginTop: '1rem' }}>
        <button className="link" type="button" onClick={signOut}>Annuler</button>
      </p>
    </div>
  )
}
