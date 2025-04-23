// Cache version - increment this when you update your assets
const CACHE_VERSION = 'v0.4.2';
const CACHE_NAME = `btc-tracker-${CACHE_VERSION}`;

// Assets to cache
const ASSETS = [
  '/',
  '/index.html',
  '/transactions.html',
  '/exchanges.html',
  '/admin.html',
  '/styles.css',
  '/images/bitcoin-icon.svg',
  '/images/favicon.ico',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

// Install service worker and cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(ASSETS);
      })
  );
  // Activate new service worker immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('btc-tracker-') && cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return clients.claim();
    })
  );
});

// Fetch event - network first, then cache strategy for assets
self.addEventListener('fetch', event => {
  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response
        const responseToCache = response.clone();

        // Cache successful responses
        if (response.status === 200) {
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
        }

        return response;
      })
      .catch(() => {
        // If network fails, try to serve from cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If both network and cache fail, show fallback for HTML requests
            if (event.request.url.indexOf('.html') > -1) {
              return caches.match('/index.html');
            }
            return new Response('Network error occurred', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
}); 