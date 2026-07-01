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

// Lit une erreur éventuelle renvoyée par un lien e-mail (ex. lien expiré),
// présente dans le hash (#error=...) ou la query (?error=...).
function readLinkError() {
  const raw = (window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, ''))
  if (!raw) return null
  const p = new URLSearchParams(raw)
  const code = p.get('error_code') || ''
  const desc = p.get('error_description') || ''
  if (!p.get('error') && !code && !desc) return null
  if (/expired|invalid|otp/i.test(`${code} ${desc}`)) {
    return 'Ce lien a expiré ou a déjà été utilisé. Redemande un lien ci-dessous, et clique le plus récent rapidement.'
  }
  return decodeURIComponent(desc.replace(/\+/g, ' ')) || 'Lien invalide.'
}

export default function Login() {
  const [mode, setMode] = useState('login')   // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)

  // Avis transmis depuis l'appli (ex. compte supprimé) : affiché une fois.
  const { notice, setNotice } = useAuth()
  const [banner] = useState(notice)
  // Erreur d'un lien e-mail (expiré, etc.) capturée depuis l'URL.
  const [linkError] = useState(readLinkError)
  useEffect(() => {
    if (notice) setNotice(null)
    if (linkError) {
      setMode('signup')  // bouton « Recevoir le lien de création » à portée
      window.history.replaceState(null, '', window.location.pathname)  // nettoie l'URL
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

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
      // Cercle maîtrisé : un code d'accès partagé est requis pour s'inscrire.
      // Vérifié côté serveur (le code n'est pas dans le bundle JS).
      const { data: ok, error: codeErr } = await supabase.rpc('check_access_code', {
        p_code: accessCode,
      })
      if (codeErr || !ok) {
        setError("Code d'accès invalide. Demande-le à la personne qui t'a invité·e.")
        setBusy(false)
        return
      }
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
      {linkError && <p className="error">{linkError}</p>}

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

        {mode === 'signup' && (
          <>
            <label htmlFor="access-code">Code d'accès</label>
            <input id="access-code" type="text" required value={accessCode}
              autoComplete="off" autoCapitalize="characters" spellCheck={false}
              onChange={(e) => setAccessCode(e.target.value)} placeholder="Code partagé entre amis" />
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
