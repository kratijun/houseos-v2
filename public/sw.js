const CACHE_VERSION = 'houseos-shell-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/houseos.svg', '/icons/houseos-192.png', '/icons/houseos-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then(cache => cache.put('/index.html', copy));
      return response;
    }).catch(() => caches.match('/index.html')));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
    return response;
  }))); 
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || 'In HouseOS gibt es etwas Neues.' }; }
  event.waitUntil(self.registration.showNotification(payload.title || 'HouseOS', {
    body: payload.body || 'In HouseOS gibt es etwas Neues.',
    icon: payload.icon || '/icons/houseos-192.png',
    badge: '/icons/houseos-192.png',
    tag: payload.tag || 'houseos',
    renotify: true,
    data: { url: payload.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) target.href = self.location.origin;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const client = clients[0];
    if (client) {
      if ('navigate' in client) await client.navigate(target.href);
      return client.focus();
    }
    return self.clients.openWindow(target.href);
  }));
});
