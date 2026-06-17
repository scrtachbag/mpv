import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="card narrow">
      <h1>🚴 Mon Petit Vélo</h1>
      <p className="muted">Paris entre amis sur le Tour de France — sans argent, pour la gloire.</p>
      {sent ? (
        <p className="success">
          📬 Un lien de connexion a été envoyé à <strong>{email}</strong>.
          Ouvre-le sur cet appareil pour te connecter.
        </p>
      ) : (
        <form onSubmit={submit}>
          <label htmlFor="email">Ton adresse e-mail</label>
          <input
            id="email" type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom@exemple.fr"
          />
          <button className="primary" disabled={busy}>
            {busy ? 'Envoi…' : 'Recevoir mon lien de connexion'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}
    </div>
  )
}
