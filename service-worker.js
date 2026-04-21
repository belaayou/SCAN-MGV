const CACHE_NAME = 'stellantis-mgv-v5.2';

// Liste des fichiers à sauvegarder dans le téléphone
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './tailwind.js',    // Votre fichier local
  './html5-qrcode.min.js',      // Votre fichier local
  './IMG_20260413_130653.png'        
];

// Installation : On télécharge les fichiers dans le cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activation : On nettoie les anciennes versions du cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
});

// Interception des requêtes : On sert le cache si on est hors-ligne
self.addEventListener('fetch', (event) => {
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
