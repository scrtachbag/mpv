// Edge Function : envoie une notification push quand un nouveau message de chat
// est inséré. Déclenchée par un webhook base de données (INSERT sur messages).
//
// Sécurité : la clé VAPID privée reste côté serveur. La fonction vérifie un
// secret partagé (en-tête x-webhook-secret) pour n'être appelable que par le
// webhook — déployer avec --no-verify-jwt.
//
// Secrets attendus (supabase secrets set ...) :
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
//   MPV_SITE_URL          (URL ouverte au clic)
//   NOTIFY_HOOK_SECRET    (même valeur que l'en-tête du webhook)
// (SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.)
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('NOTIFY_HOOK_SECRET')
    if (secret && req.headers.get('x-webhook-secret') !== secret) {
      return new Response('forbidden', { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const msg = body.record            // ligne insérée : { id, user_id, content, ... }
    if (!msg?.user_id || !msg?.content) return new Response('no record', { status: 200 })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const [{ data: author }, { data: prefs }, { data: subs }] = await Promise.all([
      supabase.from('profiles').select('pseudo').eq('id', msg.user_id).maybeSingle(),
      supabase.from('profiles').select('id, notify_enabled, notify_chat'),
      supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id'),
    ])

    // Destinataires : tous sauf l'auteur, qui veulent les notifs de chat.
    const wanted = new Set((prefs ?? [])
      .filter((p) => p.id !== msg.user_id && p.notify_enabled && p.notify_chat)
      .map((p) => p.id))
    const targets = (subs ?? []).filter((s) => wanted.has(s.user_id))
    if (targets.length === 0) return new Response('no targets', { status: 200 })

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@mon-petit-velo.fr',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )
    const text = String(msg.content)
    const payload = JSON.stringify({
      title: `💬 ${author?.pseudo ?? 'Mon Petit Vélo'}`,
      body: text.length > 90 ? text.slice(0, 90) + '…' : text,
      url: Deno.env.get('MPV_SITE_URL') ?? '/',
      tag: 'mpv-chat',   // les messages successifs remplacent la même notif
    })

    await Promise.all(targets.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
      ).catch(async (e: unknown) => {
        const code = (e as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {   // abonnement expiré
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      })
    ))
    return new Response('ok', { status: 200 })
  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
})
