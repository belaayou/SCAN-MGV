// ============================================================
//  STELLANTIS MGV — Service Worker v13.0
//  Stratégie : Cache-First pour assets statiques
//              Network-First pour Google Apps Script
//              Queue offline pour les scans non synchronisés
// ============================================================

const CACHE_NAME = 'stellantis-mgv-v13';
const SYNC_TAG   = 'sync-scans';

// Assets à mettre en cache lors de l'installation
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './IMG_20260413_130653.png',
    // CDN — mis en cache au premier chargement (voir fetch handler)
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/html5-qrcode',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;800&family=Inter:wght@400;900&display=swap'
];

// ─────────────────────────────────────────────
//  INSTALL : mise en cache des assets statiques
// ─────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // On essaie de mettre en cache chaque ressource individuellement
            // pour éviter qu'une erreur bloque tout le reste
            return Promise.allSettled(
                STATIC_ASSETS.map(url =>
                    cache.add(url).catch(err =>
                        console.warn(`[SW] Impossible de mettre en cache: ${url}`, err)
                    )
                )
            );
        }).then(() => self.skipWaiting())
    );
});

// ─────────────────────────────────────────────
//  ACTIVATE : suppression des vieux caches
// ─────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log(`[SW] Suppression ancien cache: ${key}`);
                        return caches.delete(key);
                    })
            )
        ).then(() => self.clients.claim())
    );
});

// ─────────────────────────────────────────────
//  FETCH : stratégie hybride
// ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // ── 1. Requêtes vers Google Apps Script (API Stellantis) ──
    if (url.hostname === 'script.google.com') {
        event.respondWith(handleGoogleScript(event.request));
        return;
    }

    // ── 2. Google Fonts (cache-first, pas critique) ──
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    // ── 3. Tous les autres assets (cache-first avec fallback réseau) ──
    event.respondWith(cacheFirst(event.request));
});

// ─────────────────────────────────────────────
//  BACKGROUND SYNC : envoi des scans en attente
// ─────────────────────────────────────────────
self.addEventListener('sync', event => {
    if (event.tag === SYNC_TAG) {
        console.log('[SW] Background Sync déclenché — envoi des scans en attente');
        event.waitUntil(syncPendingScans());
    }
});

// ─────────────────────────────────────────────
//  MESSAGE : communication avec la page
// ─────────────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    // La page peut demander une synchro manuelle
    if (event.data && event.data.type === 'SYNC_NOW') {
        syncPendingScans().then(() => {
            event.source.postMessage({ type: 'SYNC_DONE' });
        });
    }
});

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════

/**
 * Cache-First : on sert depuis le cache, sinon réseau + mise en cache
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response && response.status === 200 && response.type !== 'opaque') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        // Ressource introuvable et pas de cache → réponse vide
        return new Response('Ressource indisponible hors-ligne', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

/**
 * Gestion des appels Google Apps Script
 * - En ligne  → on tente le réseau, on stocke l'URL en file si échec
 * - Hors-ligne → on stocke l'URL dans la queue IDB et on répond « en attente »
 */
async function handleGoogleScript(request) {
    const url = request.url;

    // Opérations de LECTURE (login, register) : toujours réseau
    if (url.includes('action=login') || url.includes('action=register')) {
        try {
            return await fetch(request);
        } catch {
            return jsonResponse({ status: 'offline', message: 'Pas de connexion Internet.' });
        }
    }

    // Opérations de SCAN (saveScan) : réseau si dispo, sinon queue
    if (url.includes('action=saveScan')) {
        if (navigator.onLine) {
            try {
                const response = await fetch(request);
                return response;
            } catch {
                await queueRequest(url);
                return jsonResponse({ status: 'queued', message: 'Scan mis en file d\'attente.' });
            }
        } else {
            await queueRequest(url);
            return jsonResponse({ status: 'queued', message: 'Hors-ligne — scan mis en file d\'attente.' });
        }
    }

    // Autres appels Google : tentative réseau simple
    try {
        return await fetch(request);
    } catch {
        return jsonResponse({ status: 'error', message: 'Hors-ligne.' });
    }
}

function jsonResponse(data) {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
}

// ──────────────────────────────────────────────
//  FILE D'ATTENTE (IndexedDB) pour les scans
// ──────────────────────────────────────────────
const DB_NAME    = 'stellantis-sw-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending-requests';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            e.target.result.createObjectStore(STORE_NAME, {
                keyPath: 'id', autoIncrement: true
            });
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
}

async function queueRequest(url) {
    const db    = await openDB();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ url, timestamp: Date.now() });
    return new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror    = e => rej(e.target.error);
    });
}

async function getPendingRequests() {
    const db    = await openDB();
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((res, rej) => {
        const req = store.getAll();
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e.target.error);
    });
}

async function deleteRequest(id) {
    const db    = await openDB();
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror    = e => rej(e.target.error);
    });
}

/**
 * Rejoue tous les scans en attente dans IndexedDB
 */
async function syncPendingScans() {
    const pending = await getPendingRequests();
    console.log(`[SW] ${pending.length} scan(s) en attente à synchroniser`);

    for (const item of pending) {
        try {
            const response = await fetch(item.url);
            if (response.ok) {
                await deleteRequest(item.id);
                console.log(`[SW] Scan synchronisé: ${item.url}`);

                // Notifier toutes les fenêtres ouvertes
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SCAN_SYNCED',
                        url: item.url,
                        timestamp: item.timestamp
                    });
                });
            }
        } catch (err) {
            console.warn(`[SW] Échec sync scan (sera réessayé):`, err);
            // On laisse l'entrée dans la queue pour le prochain sync
        }
    }
}
