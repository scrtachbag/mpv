import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [pseudo, setPseudo] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
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
      <h1>Bienvenue !</h1>
      <p className="muted">Choisis le pseudo qui apparaîtra au classement.</p>
      <form onSubmit={submit}>
        <label htmlFor="pseudo">Pseudo</label>
        <input
          id="pseudo" required minLength={2} maxLength={24} value={pseudo}
          onChange={(e) => setPseudo(e.target.value)} placeholder="Le Blaireau"
        />
        <button className="primary" disabled={busy}>
          {busy ? '…' : 'C’est parti'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
