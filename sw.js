const CACHE_NAME = 'tasco-dlk-cache-v4';
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
  );
});

// Fetch strategy: Stale-While-Revalidate for app assets, Network-First for API requests, Cache-First for assets
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

  // Handle standard GET requests
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
