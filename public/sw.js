// RailwayBharat service worker
// Handles push notifications for train delay and platform change alerts

const CACHE_NAME = 'rb-v1';
const STATIC_ASSETS = ['/', '/search', '/stations', '/passport'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for API routes, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // let API requests through
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: 'RailwayBharat', body: event.data?.text() ?? 'Train update' };
  }

  const { title = 'RailwayBharat', body = 'Train update', trainNumber, type, url } = data;

  const icon = '/icons/icon-192x192.png';
  const badge = '/icons/badge-72x72.png';

  // Badge with train number
  const tag = trainNumber ? `train-${trainNumber}-${type}` : 'rb-alert';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      data: { url: url ?? (trainNumber ? `/train/${trainNumber}` : '/') },
      actions: trainNumber
        ? [{ action: 'track', title: 'Track train' }]
        : [],
      vibrate: [200, 100, 200],
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.action === 'track'
    ? event.notification.data?.url ?? '/'
    : event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(targetUrl);
        } else {
          self.clients.openWindow(targetUrl);
        }
      })
  );
});
