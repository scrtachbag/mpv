import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

const AuthContext = createContext(null)

// Capture (avant que supabase ne nettoie l'URL) une éventuelle erreur renvoyée
// par un lien e-mail — inscription OU réinitialisation — pour afficher un
// message clair au lieu d'une page blanche. Ne touche PAS un lien valide
// (jeton de récupération : pas de "error" dans le hash).
function readInitialLinkError() {
  if (typeof window === 'undefined') return null
  const raw = window.location.hash.replace(/^#/, '') || window.location.search.replace(/^\?/, '')
  if (!raw || !/error/i.test(raw)) return null
  const p = new URLSearchParams(raw)
  const code = p.get('error_code') || ''
  const desc = p.get('error_description') || ''
  if (!p.get('error') && !code && !desc) return null
  window.history.replaceState(null, '', window.location.pathname)  // nettoie l'URL
  if (/expired|invalid|otp/i.test(`${code} ${desc}`)) {
    return 'Ce lien a expiré ou a déjà été utilisé. Redemande un lien ci-dessous et clique le plus récent tout de suite.'
  }
  return decodeURIComponent(desc.replace(/\+/g, ' ')) || 'Lien invalide.'
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)  // fetch du profil en cours
  const [recovery, setRecovery] = useState(false)   // lien "mot de passe oublié" cliqué
  // Message à afficher sur l'écran de connexion (lien e-mail expiré, compte
  // supprimé, etc.). Initialisé depuis une éventuelle erreur de lien.
  const [notice, setNotice] = useState(readInitialLinkError)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); setProfileLoading(false); return }
    setProfileLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, pseudo, avatar, is_admin, seen_intro')
        .eq('id', userId)
        .maybeSingle()
      setProfile(data ?? null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data }) => {
        setSession(data.session)
        await loadProfile(data.session?.user?.id)
      })
      .catch((e) => console.error('getSession', e))
      .finally(() => setLoading(false))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
      loadProfile(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    recovery,
    clearRecovery: () => setRecovery(false),
    notice,
    setNotice,
    refreshProfile: () => loadProfile(session?.user?.id),
    signOut: async () => { setRecovery(false); await supabase.auth.signOut() },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
