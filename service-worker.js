const CACHE_NAME = 'stellantis-v4'; // On passe en v3
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './IMG_20260413_130653.png'
];

// Installation : Mise en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache ouvert');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Nettoyage des vieux caches (important pour passer de v2 à v3)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Suppression ancien cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Stratégie : Répondre avec le cache, sinon réseau
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
