import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { pushSupported, permissionState, isSubscribed, enablePush, disablePush } from '../lib/push'

export default function NotificationsCard() {
  const { user } = useAuth()
  const [supported] = useState(pushSupported())
  const [subscribed, setSubscribed] = useState(false)
  const [perm, setPerm] = useState(permissionState())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => { if (supported) isSubscribed().then(setSubscribed).catch(() => {}) }, [supported])

  async function enable() {
    setBusy(true); setMsg(null)
    try {
      await enablePush(user.id)
      setSubscribed(true); setPerm(permissionState())
      setMsg({ type: 'success', text: 'Rappels activés sur ce navigateur ✅' })
    } catch (e) { setMsg({ type: 'error', text: e.message }) }
    setBusy(false)
  }

  async function disable() {
    setBusy(true); setMsg(null)
    try {
      await disablePush(); setSubscribed(false)
      setMsg({ type: 'success', text: 'Rappels désactivés sur ce navigateur.' })
    } catch (e) { setMsg({ type: 'error', text: e.message }) }
    setBusy(false)
  }

  return (
    <div className="card">
      <h2>🔔 Rappels de pari</h2>
      {!supported ? (
        <p className="muted">Ton navigateur ne supporte pas les notifications push.</p>
      ) : perm === 'denied' ? (
        <p className="muted">
          Les notifications sont bloquées dans les réglages du navigateur pour ce site.
          Autorise-les, puis recharge la page.
        </p>
      ) : (
        <>
          <p className="muted">
            Reçois une notification <strong>~15 min avant la clôture</strong> si tu n’as pas
            encore parié. À activer sur chaque appareil/navigateur que tu utilises.
          </p>
          <button className="primary" style={{ width: 'auto' }} disabled={busy}
            onClick={subscribed ? disable : enable}>
            {busy ? '…' : subscribed ? 'Désactiver les rappels' : 'Activer les rappels'}
          </button>
          {msg && <p className={msg.type}>{msg.text}</p>}
        </>
      )}
    </div>
  )
}
