const CACHE_NAME = 'tasco-dlk-cache-v5';
const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './desktop.html',
  './gara-portal.html',
  './manifest.json'
];

// Install: pre-cache critical assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Pre-caching critical offline assets...');
        return cache.addAll(PRE_CACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(client => {
          if (client.url) client.navigate(client.url);
        });
      })
  );
});

// Fetch strategy: Network-First for HTML/app shell, Cache-First fallback for static assets.
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Skip Firebase Realtime Database websocket and REST calls
  if (requestUrl.hostname.includes('firebaseio.com') || requestUrl.pathname.includes('.json')) {
    return;
  }

  // Skip non-GET requests (e.g. POST uploads)
  if (event.request.method !== 'GET') {
    return;
  }

  const isNavigation = event.request.mode === 'navigate';
  const acceptsHtml = (event.request.headers.get('accept') || '').includes('text/html');
  const isAppHtml = isNavigation || acceptsHtml || requestUrl.pathname.endsWith('/') || requestUrl.pathname.endsWith('.html');

  if (isAppHtml) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(event.request)
          .then(cached => cached || caches.match('./desktop.html') || caches.match('./index.html') || caches.match('./'));
      })
    );
    return;
  }

  // Handle standard asset GET requests
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Serve from cache, and fetch latest in the background for next time (Stale-While-Revalidate)
        fetch(event.request).then(networkResponse => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore offline fetch errors */});

        return cachedResponse;
      }

      // If not in cache, fetch from network and dynamically cache
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(err => {
        // Fallback for HTML page when completely offline
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html') || caches.match('./');
        }
        throw err;
      });
    })
  );
});
