/**
 * Configuration du Service Worker - MGV SCAN Stellantis (sw.js)
 * Ce fichier permet de faire fonctionner l'application sans internet.
 */

// Nom du cache (versioning pour forcer la mise à jour sur le téléphone)
const CACHE_NAME = 'mgv-scan-stellantis-v3';

// Liste des ressources à stocker dans la mémoire du téléphone
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './IMG_20260328_193404.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode'
];

/**
 * Étape 1 : Installation
 * Sauvegarde des fichiers dans le cache local.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Système : Mise en cache des ressources en cours...');
      // Promise.allSettled garantit que si un fichier échoue, les autres sont quand même sauvés
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    })
  );
  self.skipWaiting();
});

/**
 * Étape 2 : Activation
 * Nettoyage des anciennes versions du cache pour libérer de l'espace.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  console.log('Système : Nouveau Service Worker activé.');
});

/**
 * Étape 3 : Stratégie de Fetch (Interception des requêtes)
 * Si internet est coupé, le système utilise les fichiers du cache.
 */
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        // Retourne le fichier depuis le cache si disponible
        if (response) return response;
        
        // Si c'est une navigation (page principale), charger l'index par défaut
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
