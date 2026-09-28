// ============================================================
// STELLANTIS MGV — SERVICE WORKER
// SCAN_MGV_APP — index.html unique
// Version OFFLINE SAFE
// ============================================================

const CACHE_NAME = 'scan-mgv-cache-v3';

// ============================================================
// RESSOURCES LOCALES RÉELLEMENT UTILISÉES
// ============================================================
//
// IMPORTANT :
// L'application principale est entièrement dans index.html.
// Ne pas ajouter /js/app.js : ce fichier n'existe pas.
//
// Les bibliothèques CDN sont volontairement gérées séparément.
// ============================================================

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './IMG_20260413_130653.png'
];

// ============================================================
// 1. INSTALLATION
// ============================================================

self.addEventListener('install', event => {

    console.log('[SW] Installation SCAN MGV —', CACHE_NAME);

    event.waitUntil(

        caches.open(CACHE_NAME)

            .then(cache => {

                console.log('[SW] Mise en cache de l’application');

                return cache.addAll(APP_SHELL);

            })

            .then(() => {

                console.log('[SW] Installation terminée');

                return self.skipWaiting();

            })

            .catch(error => {

                console.error(
                    '[SW] ERREUR installation cache :',
                    error
                );

            })

    );

});

// ============================================================
// 2. ACTIVATION
// ============================================================

self.addEventListener('activate', event => {

    console.log('[SW] Activation');

    event.waitUntil(

        caches.keys()

            .then(cacheNames => {

                return Promise.all(

                    cacheNames.map(cacheName => {

                        if (
                            cacheName.startsWith('scan-mgv-cache-') &&
                            cacheName !== CACHE_NAME
                        ) {

                            console.log(
                                '[SW] Suppression ancien cache :',
                                cacheName
                            );

                            return caches.delete(cacheName);

                        }

                        return Promise.resolve();

                    })

                );

            })

            .then(() => {

                console.log('[SW] Claim clients');

                return self.clients.claim();

            })

    );

});

// ============================================================
// 3. FETCH
// ============================================================

self.addEventListener('fetch', event => {

    const request = event.request;

    // --------------------------------------------------------
    // Seulement les requêtes GET peuvent être mises en cache.
    // --------------------------------------------------------

    if (request.method !== 'GET') {

        // IMPORTANT :
        // POST / PATCH / DELETE vers Supabase passent directement
        // à l'application.
        //
        // Le Service Worker NE modifie PAS :
        //
        // SCAN_MGV_APP
        // Supabase
        // INSERT
        // UPDATE
        // DELETE
        //
        // La synchronisation est gérée par index.html.

        return;

    }

    const url = new URL(request.url);

    // ========================================================
    // SUPABASE
    // ========================================================

    // Ne jamais mettre en cache les données Supabase.
    //
    // L'application utilise localStorage pour son fonctionnement
    // offline.
    //
    // Les données serveur doivent toujours venir de Supabase
    // lorsqu'une connexion est disponible.

    if (
        url.hostname.endsWith('.supabase.co') ||
        url.hostname === 'supabase.co'
    ) {

        return;

    }

    // ========================================================
    // CDN
    // ========================================================

    // html5-qrcode et supabase-js sont chargés depuis CDN.
    //
    // Pour permettre le démarrage offline après une première
    // ouverture ONLINE, on utilise :
    //
    // Cache First + téléchargement lors de la première connexion.
    //
    // Les CDN sont traités séparément afin de ne pas mettre en
    // cache les API Supabase.

    if (
        url.hostname === 'unpkg.com' ||
        url.hostname === 'cdn.jsdelivr.net' ||
        url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com'
    ) {

        event.respondWith(

            caches.match(request)

                .then(cachedResponse => {

                    if (cachedResponse) {

                        return cachedResponse;

                    }

                    return fetch(request)

                        .then(networkResponse => {

                            if (
                                networkResponse &&
                                networkResponse.ok
                            ) {

                                const responseClone =
                                    networkResponse.clone();

                                caches.open(CACHE_NAME)
                                    .then(cache => {

                                        cache.put(
                                            request,
                                            responseClone
                                        );

                                    });

                            }

                            return networkResponse;

                        })

                        .catch(() => {

                            console.warn(
                                '[SW] CDN indisponible offline :',
                                request.url
                            );

                            return new Response(
                                '',
                                {
                                    status: 503,
                                    statusText:
                                        'Ressource CDN indisponible hors ligne'
                                }
                            );

                        });

                })

        );

        return;

    }

    // ========================================================
    // APPLICATION LOCALE
    // ========================================================

    event.respondWith(

        caches.match(request)

            .then(cachedResponse => {

                if (cachedResponse) {

                    // ------------------------------------------------
                    // Retour immédiat du cache.
                    //
                    // Mise à jour silencieuse en arrière-plan.
                    // ------------------------------------------------

                    fetch(request)

                        .then(networkResponse => {

                            if (
                                networkResponse &&
                                networkResponse.ok
                            ) {

                                const clone =
                                    networkResponse.clone();

                                caches.open(CACHE_NAME)
                                    .then(cache => {

                                        cache.put(
                                            request,
                                            clone
                                        );

                                    });

                            }

                        })

                        .catch(() => {
                            // Offline : le cache reste utilisé.
                        });

                    return cachedResponse;

                }

                // ------------------------------------------------
                // Pas dans le cache → réseau.
                // ------------------------------------------------

                return fetch(request)

                    .catch(() => {

                        // ------------------------------------------------
                        // Navigation principale offline.
                        // ------------------------------------------------

                        if (
                            request.mode === 'navigate' ||
                            request.destination === 'document'
                        ) {

                            return caches.match('./index.html');

                        }

                        return new Response(
                            '',
                            {
                                status: 503,
                                statusText:
                                    'Ressource indisponible hors ligne'
                            }
                        );

                    });

            })

    );

});

// ============================================================
// 4. BACKGROUND SYNC
// ============================================================
//
// IMPORTANT :
//
// L'actuel index.html possède déjà :
//
// window.addEventListener('online', ...)
//
// avec :
//
// flushPendingDeletes()
// autoSyncPendingScans()
// fetchLogsFromSupabase()
//
// Nous ne créons donc PAS une deuxième synchronisation ici.
//
// Le Service Worker ne doit pas envoyer directement les scans
// vers Supabase.
//
// ============================================================

self.addEventListener('sync', event => {

    if (event.tag !== 'scan-mgv-sync') {

        return;

    }

    console.log(
        '[SW] Background Sync demandé'
    );

    event.waitUntil(

        notifyClientsToSync()

    );

});

// ============================================================
// 5. NOTIFICATION DE L'APPLICATION
// ============================================================

async function notifyClientsToSync() {

    const clientsList =
        await self.clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        });

    for (const client of clientsList) {

        client.postMessage({

            type: 'SCAN_MGV_SYNC_REQUEST'

        });

    }

    console.log(
        '[SW] Demande de synchronisation envoyée à index.html'
    );

}

// ============================================================
// 6. MESSAGES DEPUIS index.html
// ============================================================

self.addEventListener('message', event => {

    if (!event.data) {

        return;

    }

    // --------------------------------------------------------
    // Permet à index.html de demander l'activation immédiate
    // --------------------------------------------------------

    if (event.data.type === 'SKIP_WAITING') {

        self.skipWaiting();

    }

    // --------------------------------------------------------
    // Diagnostic
    // --------------------------------------------------------

    if (event.data.type === 'GET_SW_STATUS') {

        if (event.source) {

            event.source.postMessage({

                type: 'SW_STATUS',

                cache: CACHE_NAME,

                online: true

            });

        }

    }

});

// ============================================================
// FIN SERVICE WORKER
// ============================================================
