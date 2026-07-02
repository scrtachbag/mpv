import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { pushSupported, permissionState, isSubscribed, enablePush, disablePush } from '../lib/push'

// Types de notifications que l'utilisateur peut activer/désactiver.
const TYPES = [
  { key: 'notify_open', label: 'Nouvelle étape ouverte' },
  { key: 'notify_reminder', label: 'Rappel avant la clôture (~30 min)' },
  { key: 'notify_close', label: 'Paris fermés' },
  { key: 'notify_results', label: 'Résultats publiés' },
  { key: 'notify_chat', label: 'Nouveau message dans le chat' },
]

export default function NotificationsCard() {
  const { user } = useAuth()
  const [supported] = useState(pushSupported())
  const [subscribed, setSubscribed] = useState(false)
  const [perm, setPerm] = useState(permissionState())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [prefs, setPrefs] = useState(null)   // préférences par type (par compte)

  useEffect(() => { if (supported) isSubscribed().then(setSubscribed).catch(() => {}) }, [supported])
  useEffect(() => {
    supabase.from('profiles')
      .select('notify_enabled, notify_open, notify_reminder, notify_close, notify_results, notify_chat')
      .eq('id', user.id).single()
      .then(({ data }) => { if (data) setPrefs(data) })
  }, [user.id])

  async function enable() {
    setBusy(true); setMsg(null)
    try {
      await enablePush(user.id)
      setSubscribed(true); setPerm(permissionState())
      setMsg(null)   // la ligne « ✅ Activées sur cet appareil » suffit (pas de doublon)
    } catch (e) { setMsg({ type: 'error', text: e.message }) }
    setBusy(false)
  }

  async function disable() {
    setBusy(true); setMsg(null)
    try {
      await disablePush(); setSubscribed(false)
      setMsg({ type: 'success', text: 'Notifications désactivées sur cet appareil.' })
    } catch (e) { setMsg({ type: 'error', text: e.message }) }
    setBusy(false)
  }

  // Enregistre une préférence (optimiste) sur le compte.
  async function savePref(patch) {
    setPrefs((p) => ({ ...p, ...patch }))
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) setMsg({ type: 'error', text: error.message })
  }

  return (
    <div className="card">
      <h2>🔔 Notifications</h2>
      {!supported ? (
        <p className="muted">Ton navigateur ne supporte pas les notifications push.</p>
      ) : perm === 'denied' ? (
        <p className="muted">
          Les notifications sont bloquées dans les réglages du navigateur pour ce site.
          Autorise-les, puis recharge la page.
        </p>
      ) : !subscribed ? (
        <>
          <p className="muted">
            Reçois une alerte pour les moments clés du jeu. À activer sur
            <strong> chaque appareil</strong> où tu veux les recevoir.
          </p>
          <button className="primary" style={{ width: 'auto' }} disabled={busy} onClick={enable}>
            {busy ? '…' : 'Activer les notifications sur cet appareil'}
          </button>
          {msg && <p className={msg.type}>{msg.text}</p>}
        </>
      ) : (
        <>
          <p className="success" style={{ margin: '.2rem 0 .1rem' }}>✅ Activées sur cet appareil</p>
          {msg && <p className={msg.type}>{msg.text}</p>}

          {prefs && (
            <>
              <p style={{ fontWeight: 600, margin: '.9rem 0 .3rem' }}>Me prévenir quand :</p>
              {TYPES.map((t) => (
                <label key={t.key} className="checkbox">
                  <input type="checkbox" checked={prefs[t.key]}
                    onChange={(e) => savePref({ [t.key]: e.target.checked })} />
                  {t.label}
                </label>
              ))}
            </>
          )}

          <p className="muted" style={{ fontSize: '.85rem', margin: '.9rem 0 .3rem' }}>
            Ces choix s’appliquent à tous tes appareils. Pour ne plus rien recevoir ici,
            désactive sur cet appareil :
          </p>
          <button className="link" type="button" disabled={busy} onClick={disable}>
            Désactiver sur cet appareil
          </button>
        </>
      )}
    </div>
  )
}
