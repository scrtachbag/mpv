import { supabase } from '../supabaseClient'

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SW_URL = import.meta.env.BASE_URL + 'sw.js'

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function permissionState() {
  return pushSupported() ? Notification.permission : 'unsupported'  // default | granted | denied
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function registration() {
  return navigator.serviceWorker.register(SW_URL)
}

// L'utilisateur est-il déjà abonné sur ce navigateur ?
export async function isSubscribed() {
  if (!pushSupported()) return false
  const reg = await registration()
  return Boolean(await reg.pushManager.getSubscription())
}

export async function enablePush(userId) {
  if (!pushSupported()) throw new Error('Notifications non supportées par ce navigateur.')
  if (!VAPID_PUBLIC) throw new Error('Clé VAPID publique absente (VITE_VAPID_PUBLIC_KEY).')

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Autorisation refusée.')

  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
  }
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function disablePush() {
  if (!pushSupported()) return
  const reg = await registration()
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}
