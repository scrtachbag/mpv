import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'

// Finalisation du compte après clic sur le lien e-mail de création :
// l'utilisateur choisit son pseudo et définit son mot de passe.
export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)

    // 1) définit le mot de passe sur la session ouverte par le lien e-mail.
    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) { setBusy(false); setError(pwErr.message); return }

    // 2) crée le profil (pseudo).
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      pseudo: pseudo.trim(),
    })
    setBusy(false)
    if (error) {
      setError(error.code === '23505'
        ? 'Ce pseudo est déjà pris, essaie-en un autre.'
        : error.message)
    } else {
      await refreshProfile()
    }
  }

  return (
    <div className="card narrow">
      <h1>Crée ton compte</h1>
      <p className="muted">Identifié par <strong>{user.email}</strong>. Choisis ton pseudo et ton mot de passe.</p>
      <form onSubmit={submit}>
        <label htmlFor="pseudo">Pseudo</label>
        <input id="pseudo" required minLength={2} maxLength={24} value={pseudo}
          onChange={(e) => setPseudo(e.target.value)} placeholder="Le Blaireau" />

        <label htmlFor="password">Mot de passe</label>
        <input id="password" type="password" required minLength={6} value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)} placeholder="•••••• (6 caractères min.)" />

        <button className="primary" disabled={busy}>
          {busy ? '…' : 'C’est parti'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
