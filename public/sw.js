// PostCommand Service Worker — v6
const CACHE_VERSION = 'v6'
const CACHE_NAME = `postcommand-${CACHE_VERSION}`

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return
  // Network first, cache as fallback — never block on cache errors
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title || 'PostCommand', {
      body: data.body || '',
      icon: '/favicon-192.png',
      badge: '/favicon-192.png',
      tag: data.tag || 'postcommand',
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const url = e.notification.data?.url || '/'
      const existing = cls.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url); return }
      return clients.openWindow(url)
    })
  )
})
