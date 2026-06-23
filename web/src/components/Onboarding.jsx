import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { AVATARS, randomAvatarKey } from '../lib/avatars'
import Avatar from './Avatar.jsx'

// Finalisation du compte : pseudo, mot de passe et choix de l'avatar.
export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [pseudo, setPseudo] = useState('')
  const [password, setPassword] = useState('')
  const [avatar, setAvatar] = useState(() => randomAvatarKey())
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)

    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) { setBusy(false); setError(pwErr.message); return }

    const { error } = await supabase.from('profiles').insert({
      id: user.id, email: user.email, pseudo: pseudo.trim(), avatar,
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
      <h1>Crée ton profil 🚴</h1>
      <p className="muted">Identifié par <strong>{user.email}</strong>.</p>
      <form onSubmit={submit}>
        <label htmlFor="pseudo">Pseudo</label>
        <input id="pseudo" type="text" required minLength={2} maxLength={24} value={pseudo}
          onChange={(e) => setPseudo(e.target.value)} placeholder="Le Blaireau" />

        <label htmlFor="password">Mot de passe</label>
        <input id="password" type="password" required minLength={6} value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)} placeholder="•••••• (6 caractères min.)" />

        <label>Ton avatar</label>
        <div className="avatar-grid">
          {AVATARS.map((a) => (
            <button type="button" key={a.key}
              className={`avatar-choice${avatar === a.key ? ' selected' : ''}`}
              onClick={() => setAvatar(a.key)} title={a.label}>
              <Avatar name={a.key} size={44} />
            </button>
          ))}
        </div>

        <button className="primary" disabled={busy}>
          {busy ? '…' : 'C’est parti !'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
