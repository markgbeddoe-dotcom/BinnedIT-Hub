// SkipSync — Service Worker
// Provides offline capability and PWA support

const CACHE_NAME = 'skipsync-v2-2';
const OFFLINE_URL = '/';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.jpg',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;
  if (event.request.url.includes('supabase.co')) return;

  // Sprint 12 #16: defensively exclude /driver paths from the admin SW so
  // the dedicated driver SW (`sw-driver.js`) owns that scope without overlap.
  // The two SWs are registered against different URL prefixes via index.html,
  // but we double-down here in case both happen to be active during an
  // upgrade/transition window.
  try {
    const reqUrl = new URL(event.request.url);
    if (reqUrl.pathname === '/driver' || reqUrl.pathname.indexOf('/driver/') === 0) {
      return;
    }
  } catch (e) { /* fall through — non-fatal */ }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached, but also fetch fresh in background
        fetch(event.request).then((freshResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, freshResponse.clone());
          });
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Only cache successful, non-opaque responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Return the app shell for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Push notification support
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SkipSync Alert';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/logo.jpg',
    badge: '/favicon.svg',
    data: data.url || '/',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/')
  );
});
