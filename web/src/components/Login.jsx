import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'

function traduire(error) {
  const m = error?.message || ''
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.'
  if (/Email not confirmed/i.test(m)) return 'E-mail non confirmé : vérifie ta boîte mail.'
  if (/rate limit|too many/i.test(m)) return 'Trop de tentatives, réessaie dans un instant.'
  return m
}

// URL de retour après clic sur un lien e-mail (création de compte / réinit).
const redirectTo = window.location.origin + window.location.pathname

export default function Login() {
  const [mode, setMode] = useState('login')   // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  // Avis transmis depuis l'appli (ex. compte supprimé) : affiché une fois.
  const { notice, setNotice } = useAuth()
  const [banner] = useState(notice)
  useEffect(() => { if (notice) setNotice(null) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function go(next) { setMode(next); setError(null); setInfo(null) }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null); setInfo(null)
    const mail = email.trim()

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
      if (error) setError(traduire(error))
      // succès : onAuthStateChange (auth.jsx) prend le relais.
    } else if (mode === 'signup') {
      // Envoi d'un lien : en cliquant, l'utilisateur revient finaliser son
      // compte (pseudo + mot de passe) sur la page Onboarding.
      const { error } = await supabase.auth.signInWithOtp({
        email: mail,
        options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
      })
      if (error) setError(traduire(error))
      else setInfo(`📬 Lien envoyé à ${mail}. Clique-le pour finaliser ton compte (pseudo + mot de passe).`)
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo })
      if (error) setError(traduire(error))
      else setInfo(`📬 Si un compte existe pour ${mail}, un lien de réinitialisation vient d'être envoyé.`)
    }
    setBusy(false)
  }

  return (
    <div className="card narrow">
      <h1>🚴 Mon Petit Vélo</h1>
      <p className="muted">Paris entre amis sur le Tour de France — sans argent, pour la gloire.</p>

      {banner && <p className="banner-notice">{banner}</p>}

      <form onSubmit={submit}>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" required value={email} autoComplete="email"
          onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />

        {mode === 'login' && (
          <>
            <label htmlFor="password">Mot de passe</label>
            <input id="password" type="password" required minLength={6} value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </>
        )}

        <button className="primary" disabled={busy}>
          {busy ? '…'
            : mode === 'login' ? 'Se connecter'
            : mode === 'signup' ? 'Recevoir le lien de création'
            : 'Recevoir le lien de réinitialisation'}
        </button>
        {error && <p className="error">{error}</p>}
        {info && <p className="success">{info}</p>}
      </form>

      <div className="muted" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
        {mode === 'login' && <>
          <span>Pas encore de compte ?{' '}
            <button className="link" type="button" onClick={() => go('signup')}>Créer un compte</button></span>
          <span>Mot de passe oublié ?{' '}
            <button className="link" type="button" onClick={() => go('forgot')}>Réinitialiser</button></span>
        </>}
        {mode !== 'login' && (
          <button className="link" type="button" onClick={() => go('login')}>← Retour à la connexion</button>
        )}
      </div>
    </div>
  )
}
