// Service Worker for Eat-Poop-Sleep Tracker
// Enables offline functionality and caching

const CACHE_NAME = 'eps-tracker-v2';
// Get the base path for GitHub Pages (works for both root and subdirectory)
const basePath = self.location.pathname.split('/').slice(0, -1).join('/') || '/';
const urlsToCache = [
  basePath + '/',
  basePath + '/index.html',
  basePath + '/app.js',
  basePath + '/app.css',
  basePath + '/manifest.json',
  basePath + '/icon-192.png',
  basePath + '/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Always try to fetch from network first for app.js to get updates
        if (event.request.url.includes('app.js') || event.request.url.includes('index.html')) {
          return fetch(event.request)
            .then((networkResponse) => {
              // Update cache with new version
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone);
              });
              return networkResponse;
            })
            .catch(() => {
              // If network fails, return cached version
              return response;
            });
        }
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      ).then(() => {
        // Force update by claiming all clients
        return self.clients.claim();
      });
    })
  );
});

