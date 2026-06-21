/* Service worker MPV — notifications push (rappel de pari). */

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || '🚴 Mon Petit Vélo'
  const options = {
    body: data.body || 'N’oublie pas ton pari du jour !',
    icon: data.icon || undefined,
    badge: data.badge || undefined,
    tag: data.tag || 'mpv-reminder',   // remplace la précédente du même type
    data: { url: data.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
