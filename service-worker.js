const CACHE_NAME = 'stellantis-mgv-v6'; // Change le chiffre à chaque modif
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './IMG_20260413_130653.png'
];

// Installation : On force la mise en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activation : On supprime les vieux caches pour éviter les bugs
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
});

// INTERCEPTION : C'est ici que la magie opère
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // On donne le cache si on l'a, sinon on va sur le réseau
      return response || fetch(event.request).catch(() => {
        // Si même le réseau échoue (hors ligne), on renvoie index.html par défaut
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
