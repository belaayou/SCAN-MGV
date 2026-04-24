const CACHE_NAME = 'stellantis-mgv-v5.7';

const ASSETS = [
  './',
  './index.html',      // ← vérifie ce nom !
  './manifest.json',
  './tailwind.js',
  './html5-qrcode.min.js',
  './IMG_20260413_130653.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('script.google.com')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html'); // ← même nom
        }
      });
    })
  );
});self.addEventListener('fetch', (event) => {
  // On laisse passer les requêtes Google Sheets (envoi de données)
  if (event.request.url.includes('script.google.com')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retourne le fichier du cache s'il existe, sinon tente le réseau
      return response || fetch(event.request).catch(() => {
        // Si tout échoue (hors-ligne complet), on renvoie index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
