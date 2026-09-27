Nouveau fichier service-worker.js
// ==========================================
// CONFIGURATION ET CACHE
// ==========================================
const CACHE_NAME = 'scan-mgv-cache-v1';
const SUPABASE_URL = 'https://rdhmsbqhjlmtlgrjuyxa.supabase.co'; // Remplacez par votre URL Supabase
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkaG1zYnFoamxtdGxncmp1eXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzUxMzgsImV4cCI6MjA5NTgxMTEzOH0.0jpyr9n1TfctS28515NESvYndy03osk2nEYugksAwIo';                // Remplacez par votre clé Anon Supabase

// Ressources statiques à mettre en cache pour le mode Offline
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/icons/icon-192.png'
];

// ==========================================
// 1. INSTALLATION ET ACTIVATION
// ==========================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Mise en cache des ressources statiques');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Nettoyage de l\'ancien cache :', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ==========================================
// 2. LOGIQUE DE NETTOYAGE ET VALIDATION DES CODES
// ==========================================
const VALID_PREFIXES = ['T51', 'V50', 'S50', 'S51', 'S512', 'S504', 'R50', 'M5', 'N5', 'P5'];

function cleanAndValidateCode(rawCode) {
  if (!rawCode) return null;

  let code = rawCode.trim().toUpperCase();

  // Correction OCR : Remplacement des erreurs sur la 1ère lettre (ex: Q, F, Z -> T)
  if (code.match(/^[QFZ]51/)) {
    code = code.replace(/^[QFZ]/, 'T');
  }

  // Vérification de la validité du préfixe et de la longueur
  const hasValidPrefix = VALID_PREFIXES.some((prefix) => code.startsWith(prefix));
  const hasValidLength = code.length >= 7 && code.length <= 12;

  return (hasValidPrefix && hasValidLength) ? code : null;
}

// ==========================================
// 3. INTERCEPTION DES REQUÊTES (FETCH)
// ==========================================
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Cas A : Interception de l'envoi de scan vers Supabase
  if (requestUrl.pathname.includes('/rest/v1/scans') && event.request.method === 'POST') {
    event.respondWith(handleSupabaseScanPost(event.request));
    return;
  }

  // Cas B : Gestion du cache standard pour l'interface utilisateur (Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        // Retourner la réponse du cache en cas de perte de connexion
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// ==========================================
// 4. TRAITEMENT DE L'ENVOI DE SCAN VERS SUPABASE
// ==========================================
async function handleSupabaseScanPost(request) {
  try {
    const cloneRequest = request.clone();
    const payload = await cloneRequest.json();

    // Traitement/Nettoyage du code scanné
    const rawCode = payload.code || payload.scanned_code;
    const validatedCode = cleanAndValidateCode(rawCode);

    if (!validatedCode) {
      // Rejet du faux code avant même l'envoi au serveur
      return new Response(
        JSON.stringify({ error: 'Code invalide ou faux code détecté (OCR Error)', rawCode }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Mise à jour du payload avec le code nettoyé
    payload.code = validatedCode;

    // Tentative d'envoi vers Supabase
    const response = await fetch(`${SUPABASE_URL}/rest/v1/scans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    return response;

  } catch (error) {
    console.error('[SW] Erreur de réseau/envoi vers Supabase :', error);

    // En cas d'échec réseau, renvoyer une erreur explicite
    return new Response(
      JSON.stringify({ error: 'Réseau indisponible. Enregistrement en attente (Offline).' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// ==========================================
// 5. SYNCHRONISATION EN ARRIÈRE-PLAN (BACKGROUND SYNC)
// ==========================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scans') {
    event.waitUntil(syncPendingScans());
  }
});

async function syncPendingScans() {
  console.log('[SW] Tentative de synchronisation des scans enregistrés en mode hors-ligne...');
  // Insérez ici votre logique de lecture depuis IndexedDB pour envoyer les scans en attente vers Supabase
}
