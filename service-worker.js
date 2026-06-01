// ============================================================
//  STELLANTIS MGV — Service Worker v10.0 (Avec SUPABASE)
//  Stratégie : Cache-First pour assets statiques
//              Network-First pour Google Apps Script & Supabase
//              Queue offline pour les scans non synchronisés
// ============================================================

const CACHE_NAME = 'stellantis-mgv-v10.0';
const SYNC_TAG   = 'sync-scans';

// ── CONFIGURATION SUPABASE DIRECTE (REST API) ──
const SUPABASE_URL       = "https://rdhmsbqhjlmtlgrjuyxa.supabase.co"; // حط الرابط ديالك هنا
const SUPABASE_ANON_KEY  = "sb_publishable_S_NgVByTSPeH1ZE7DTSTAg_3yAoRQSK"; // المفتاح الجديد ديالك

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './IMG_20260413_130653.png',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/html5-qrcode',
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;800&family=Inter:wght@400;900&display=swap'
];

// ─────────────────────────────────────────────
//  INSTALL & ACTIVATE (نفس الكود ديالك القديم)
// ─────────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(
                STATIC_ASSETS.map(url =>
                    cache.add(url).catch(err => console.warn(`[SW] Impossible de cache: ${url}`, err))
                )
            );
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

// ─────────────────────────────────────────────
//  FETCH : stratégie hybride
// ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // 1. Requêtes vers Google Apps Script
    if (url.hostname === 'script.google.com') {
        event.respondWith(handleGoogleScript(event.request));
        return;
    }

    // 2. Google Fonts
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirst(event.request));
        return;
    }

    event.respondWith(cacheFirst(event.request));
});

// ─────────────────────────────────────────────
//  BACKGROUND SYNC
// ─────────────────────────────────────────────
self.addEventListener('sync', event => {
    if (event.tag === SYNC_TAG) {
        console.log('[SW] Background Sync déclenché');
        event.waitUntil(syncPendingScans());
    }
});

// ─────────────────────────────────────────────
//  MESSAGE
// ─────────────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'SYNC_NOW') {
        event.waitUntil(
            syncPendingScans().then(() => {
                if (event.source) event.source.postMessage({ type: 'SYNC_DONE' });
            })
        );
    }
});

// ══════════════════════════════════════════════
//  HELPERS & API SUPABASE (INSERT ONLY)
// ══════════════════════════════════════════════

/**
 * دالة إرسال السكّان مباشرة لـ Supabase عبر الـ REST API
 * { returning: 'minimal' } كتحقق هنا عبر الهيدر Prefer: return=minimal
 */
async function insertToSupabase(recordData) {
    const targetUrl = `${SUPABASE_URL}/rest/v1/scans`;
    
    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal' // هادي هي المقابل ديال returning: minimal ف الـ RLS
            },
            body: JSON.stringify(recordData)
        });

        // إذا كان السكّان ديجا كاين (Doublon)، السيرفر كيرجع ستاتيس 409، غانعتبروها نجاح باش مايبقاش مكيشي
        if (response.status === 201 || response.status === 409) {
            console.log('[SW] Données envoyées avec succès à Supabase');
            return true;
        }
        
        console.error(`[SW] Erreur Supabase Status: ${response.status}`);
        return false;
    } catch (err) {
        console.error('[SW] Échec de connexion Supabase:', err);
        return false;
    }
}

/**
 * استخراج البيانات وتفكيكها من رابط Google Script باش نصيفطوها لـ Supabase
 */
function extractRecordFromUrl(urlStr) {
    try {
        const urlObj = new URL(urlStr);
        const params = urlObj.searchParams;
        
        const scanDate = new Date();
        const formattedDate = params.get('date') || scanDate.toLocaleDateString('fr-FR');
        const formattedTime = params.get('time') || scanDate.toLocaleTimeString('fr-FR');

        return {
            scan_id:    params.get('scan_id') || crypto.randomUUID(),
            op:         params.get('op') || 'Inconnu',
            code:       params.get('code') || 'Inconnu',
            zone:       params.get('zone') || '',
            date:       formattedDate,
            time:       formattedTime,
            created_at: scanDate.toISOString()
        };
    } catch (e) {
        console.error("[SW] Erreur parsing URL:", e);
        return null;
    }
}

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
        return new Response('Offline', { status: 503 });
    }
}

async function handleGoogleScript(request) {
    const url = request.url;

    if (url.includes('action=login') || url.includes('action=register')) {
        try { return await fetch(request); } catch { return jsonResponse({ status: 'offline' }); }
    }

    if (url.includes('action=saveScan')) {
        // إذا كنا أونلاين: كنصيفطو لـ Google و Supabase معاً ف نفس الوقت
        if (navigator.onLine) {
            try {
                const response = await fetch(request);
                const recordData = extractRecordFromUrl(url);
                if (recordData) {
                    await insertToSupabase(recordData); // الإرسال المتوازي لـ Supabase
                }
                return response;
            } catch {
                await queueRequest(url);
                return jsonResponse({ status: 'queued', message: 'Scan mis en file d\'attente.' });
            }
        } else {
            await queueRequest(url);
            return jsonResponse({ status: 'queued', message: 'Hors-ligne — mis en file.' });
        }
    }
    try { return await fetch(request); } catch { return jsonResponse({ status: 'error' }); }
}

// ──────────────────────────────────────────────
//  FILE D'ATTENTE (IndexedDB) + SYNC DOUBLE
// ──────────────────────────────────────────────
const DB_NAME    = 'stellantis-sw-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending-requests';

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => { e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true }); };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
}

async function queueRequest(url) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    store = tx.objectStore(STORE_NAME);
    store.add({ url, timestamp: Date.now() });
    return new Promise(res => tx.oncomplete = res);
}

async function getPendingRequests() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return new Promise(res => { tx.objectStore(STORE_NAME).getAll().onsuccess = e => res(e.target.result); });
}

async function deleteRequest(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise(res => tx.oncomplete = res);
}

/**
 * المزامنة التلقائية المزدوجة (تفرغ السكينات لـ Google Sheet و Supabase بجوج فاش يرجع النت)
 */
async function syncPendingScans() {
    const pending = await getPendingRequests();
    console.log(`[SW] ${pending.length} scan(s) en attente`);

    for (const item of pending) {
        try {
            // 1. صيفط لـ Google Sheets
            const response = await fetch(item.url);
            if (response.ok) {
                // 2. صيفط لـ Supabase
                const recordData = extractRecordFromUrl(item.url);
                if (recordData) {
                    await insertToSupabase(recordData);
                }

                await deleteRequest(item.id);
                console.log(`[SW] Scan synchronisé partout: ${item.url}`);

                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({ type: 'SCAN_SYNCED', url: item.url, timestamp: item.timestamp });
                });
            }
        } catch (err) {
            console.warn(`[SW] Échec sync`, err);
        }
    }
}
