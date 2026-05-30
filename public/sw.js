const CACHE_STATIC = 'postcommand-static-v2'
const CACHE_DATA   = 'postcommand-data-v2'
const STATIC_ASSETS = ['/', '/reciprocity']

// Static asset extensions to cache aggressively
const STATIC_EXT = /\.(js|css|woff2?|png|jpg|svg|ico|webp)$/

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE_STATIC).then(c => c.addAll(STATIC_ASSETS).catch(()=>{})))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_STATIC && k !== CACHE_DATA).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return

  // Skip: Supabase API, external APIs
  if (url.hostname.includes('supabase.co')) return
  if (url.hostname.includes('googleapis.com')) return
  if (url.hostname.includes('nominatim.openstreetmap.org')) return
  if (url.hostname.includes('api.qrserver.com')) return

  // Cache-first: static assets (JS/CSS/images/fonts)
  if (STATIC_EXT.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE_STATIC).then(c => c.put(e.request, res.clone()))
          return res
        })
      })
    )
    return
  }

  // Stale-while-revalidate for map tiles (CartoDB)
  if (url.hostname.includes('basemaps.cartocdn.com') || url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(
      caches.open(CACHE_DATA).then(cache =>
        cache.match(e.request).then(cached => {
          const networkFetch = fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone())
            return res
          })
          return cached || networkFetch
        })
      )
    )
    return
  }

  // Network-first with offline fallback for HTML navigation
  e.respondWith(
    fetch(e.request).catch(() => {
      return caches.match(e.request) || caches.match('/')
    })
  )
})

// Background sync for queued actions (clock-in, checkpoint logs)
self.addEventListener('sync', e => {
  if (e.tag === 'sync-queue') {
    e.waitUntil(processQueue())
  }
})

async function processQueue() {
  const queue = await getQueue()
  if (!queue.length) return
  const failed = []
  for (const item of queue) {
    try {
      const res = await fetch(item.url, { method:item.method, headers:item.headers, body:item.body })
      if (!res.ok) failed.push(item)
    } catch {
      failed.push(item)
    }
  }
  await saveQueue(failed)
}

async function getQueue() {
  try {
    const db = await openDB()
    return db.getAll('sync-queue')
  } catch { return [] }
}

async function saveQueue(items) {
  try {
    const db = await openDB()
    await db.clear('sync-queue')
    for (const item of items) await db.add('sync-queue', item)
  } catch {}
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('postcommand-sync', 1)
    req.onupgradeneeded = e => e.target.result.createObjectStore('sync-queue', { autoIncrement:true })
    req.onsuccess = e => resolve(wrapDB(e.target.result))
    req.onerror = reject
  })
}

function wrapDB(db) {
  const tx = (mode) => db.transaction('sync-queue', mode).objectStore('sync-queue')
  return {
    getAll: () => new Promise((res,rej) => { const r=tx('readonly').getAll(); r.onsuccess=()=>res(r.result); r.onerror=rej }),
    clear:  () => new Promise((res,rej) => { const r=tx('readwrite').clear(); r.onsuccess=res; r.onerror=rej }),
    add:    (item) => new Promise((res,rej) => { const r=tx('readwrite').add(item); r.onsuccess=res; r.onerror=rej }),
  }
}

// Push notifications
self.addEventListener('push', e => {
  if (!e.data) return
  const data = e.data.json()
  e.waitUntil(
    self.registration.showNotification(data.title || 'PostCommand', {
      body: data.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'postcommand',
      requireInteraction: data.requireInteraction || false,
      data: { url: data.url || '/' },
      actions: data.actions || [],
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(cls => {
      const url = e.notification.data?.url || '/'
      const existing = cls.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url); return }
      return clients.openWindow(url)
    })
  )
})
