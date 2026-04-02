/**
 * Configuration du Service Worker - MGV SCAN Stellantis
 * Ce fichier permet au terminal de fonctionner sans connexion internet (Offline).
 */

const CACHE_NAME = 'mgv-scan-stellantis-v2';

// Liste des fichiers à mettre en cache pour le mode hors-ligne
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './IMG_20260328_193404.png',
  'https://unpkg.com/html5-qrcode',
  'https://cdn.tailwindcss.com'
];

// Étape 1 : Installation et mise en cache des fichiers
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Système : Mise en cache des ressources terminée');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Étape 2 : Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  console.log('Système : Service Worker activé et prêt');
});

// Étape 3 : Stratégie de récupération des fichiers (Cache First)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Retourne le fichier depuis le cache s'il existe, sinon utilise le réseau
      if (cachedResponse) {
        return cachedResponse; 
      }
      return fetch(event.request); 
    }).catch(() => {
      // Si hors-ligne et fichier non trouvé, charger la page d'accueil par défaut
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});
