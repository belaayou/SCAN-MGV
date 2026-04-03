const CACHE_NAME = 'mgv-scan-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './IMG_20260328_193404.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode'
];

// Installation : Sauvegarde des fichiers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Fetch : Utilisation des fichiers en mode Hors-ligne
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Activation : Nettoyage
self.addEventListener('activate', (event) => {
  console.log('Service Worker Activé');
});
