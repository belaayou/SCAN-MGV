const CACHE_NAME = 'stellantis-v1';
// Liste des fichiers à mettre en cache
const ASSETS = [
  './',
  './index.html',
  './IMG_20260413_130653.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;800&family=Inter:wght@400;900&display=swap'
];

// Installation : Mise en cache des fichiers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Stratégie : Répondre avec le cache, sinon chercher sur le réseau
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
