/**
 * Configuration du Service Worker - MGV SCAN Stellantis
 * Version : 7.1 (Optimisée pour le mode Hors-ligne)
 */

const CACHE_NAME = 'mgv-scan-v7.1';

// Liste des ressources critiques
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './IMG_20260328_193404.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;800&family=Inter:wght@400;900&display=swap'
];

// 1. Installation : On force la mise en cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Cache des ressources...');
      // On utilise Promise.allSettled pour ne بر لا يتوقف التثبيت إذا فشل ملف واحد
      return Promise.allSettled(ASSETS_TO_CACHE.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

// 2. Activation : On nettoie les anciens caches (v1, v2...)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. Stratégie Fetch : Priorité au Cache pour la rapidité (Mode Excelled)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Retourne le fichier stocké immédiatement
      }
      return fetch(event.request); // Sinon, va le chercher sur internet
    }).catch(() => {
      // Si panne internet totale et fichier non caché
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
                                                    
