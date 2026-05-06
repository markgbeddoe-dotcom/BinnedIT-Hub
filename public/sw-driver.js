// SkipSync Driver — Dedicated Service Worker for /driver scope
// Sprint 12 #16 (audit-ux.md §3): the admin and driver PWA shells share one
// runtime cache when they share `sw.js`, which means a stale admin chunk can
// poison the driver's run sheet (or vice versa). This worker uses its own
// CACHE_NAME and scopes its fetch handler to `/driver/*` plus the top-level
// shell assets the driver app needs to boot. Strategy mirrors `sw.js`
// (cache-first with background revalidation) so behaviour stays predictable.

const CACHE_NAME = 'skipsync-driver-v1';
const OFFLINE_URL = '/driver';

// Assets to cache on install. We deliberately do NOT hardcode hashed JS chunk
// filenames here — the fetch handler discovers them at runtime so the cache
// stays in step with whatever Vite emits per build.
const STATIC_ASSETS = [
  '/driver',
  '/manifest.json',
  '/driver-manifest.json',
  '/logo.jpg',
  '/favicon.svg',
];

// Decide whether a given request belongs to the driver SW's scope. We claim:
//   1. Anything under `/driver*` (driver app routes & deep links).
//   2. Top-level shell assets needed to bootstrap the driver SPA: the HTML
//      shell, manifests, icons, and the JS/CSS chunks Vite serves from `/assets/*`.
// Anything else (e.g. admin routes like `/dashboard`) is left for `sw.js` and
// passes straight through without being cached here.
function isDriverScope(url) {
  if (url.pathname === '/driver') return true;
  if (url.pathname.indexOf('/driver/') === 0) return true;
  // Shared shell assets the driver app must be able to load.
  if (url.pathname === '/') return true;
  if (url.pathname === '/manifest.json') return true;
  if (url.pathname === '/driver-manifest.json') return true;
  if (url.pathname === '/logo.jpg') return true;
  if (url.pathname === '/favicon.svg') return true;
  if (url.pathname === '/icon-192.png') return true;
  if (url.pathname === '/icon-512.png') return true;
  // Vite-emitted hashed chunks live under /assets/*. The driver SPA bundle is
  // a subset of these; admin's bundle is also under /assets/*. We let both
  // SWs cache their copies — they live in separate CACHE_NAMEs so no clash.
  if (url.pathname.indexOf('/assets/') === 0) return true;
  return false;
}

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
          // Only purge our own previous driver caches; leave admin caches
          // (skipsync-v*) alone so we don't disrupt the other SW.
          .filter((name) => name.indexOf('skipsync-driver-') === 0 && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and API/Supabase calls (same as sw.js).
  if (event.request.method !== 'GET') return;
  if (event.request.url.indexOf('/api/') !== -1) return;
  if (event.request.url.indexOf('supabase.co') !== -1) return;

  let url;
  try {
    url = new URL(event.request.url);
  } catch (e) {
    return;
  }

  // Only handle requests in the driver scope; let the browser deal with
  // anything else so the admin SW (registered on `/`) can claim it.
  if (!isDriverScope(url)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Cache-first with background revalidation — keeps the run sheet
        // available offline while still pulling fresh assets on the side.
        fetch(event.request).then((freshResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, freshResponse.clone());
          });
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Only cache successful, non-opaque responses.
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Offline fallback: return the driver app shell for navigations.
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Push notifications — identical contract to sw.js but defaults the click
// destination to /driver so taps from a driver-issued push land in the
// driver app instead of bouncing the user to the admin Hub.
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'SkipSync Driver';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/logo.jpg',
    badge: '/favicon.svg',
    data: data.url || '/driver',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data || '/driver')
  );
});
