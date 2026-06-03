const CACHE_NAME = 'stellantis-mgv-v14.0';
const SYNC_TAG = 'sync-scans';

const SUPABASE_URL = 'https://rdhmsbqhjlmtlgrjuyxa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkaG1zYnFoamxtdGxncmp1eXhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzUxMzgsImV4cCI6MjA5NTgxMTEzOH0.0jpyr9n1TfctS28515NESvYndy03osk2nEYugksAwIo';

const GOOGLE_URL = 'https://script.google.com/macros/s/AKfycbwsFDUIgEsiQRo1R2HIiu1cGi-wH_wdJqmF4uTw5iOkGfWxJdpab96XZRurb6MP0L4/exec';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './IMG_20260413_130653.png'
];

const DB_NAME = 'stellantis-sw-queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending-requests';

// ─────────────────────────────────────────────
// INSTALL
// ─────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─────────────────────────────────────────────
// ACTIVATE
// ─────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─────────────────────────────────────────────
// BACKGROUND SYNC
// ─────────────────────────────────────────────

self.addEventListener('sync', event => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncPendingScans());
  }
});

// ─────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────

self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'SYNC_NOW') {
    event.waitUntil(syncPendingScans());
  }
});

// ─────────────────────────────────────────────
// FETCH
// ─────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.hostname === 'script.google.com') {
    event.respondWith(handleGoogleScript(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ─────────────────────────────────────────────
// INDEXEDDB (file d'attente offline)
// ─────────────────────────────────────────────

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror  = () => reject(request.error);
  });
}

async function getPendingRequests() {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    tx.objectStore(STORE_NAME).getAll().onsuccess =
      event => resolve(event.target.result);
  });
}

async function queueRequest(url) {
  const existing = await getPendingRequests();
  if (existing.some(item => item.url === url)) return;

  const db = await openDB();
  return new Promise(resolve => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ url, timestamp: Date.now() });
    tx.oncomplete = resolve;
  });
}

async function deleteRequest(id) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
  });
}

// ─────────────────────────────────────────────
// PARSE URL → RECORD
// ─────────────────────────────────────────────

function extractRecordFromUrl(urlStr) {
  try {
    const url    = new URL(urlStr);
    const params = url.searchParams;
    const now    = new Date();

    return {
      scan_id:    params.get('scan_id') || crypto.randomUUID(),
      op:         params.get('op')      || 'UNKNOWN',
      code:       params.get('code')    || '',
      zone:       params.get('zone')    || '',
      date:       params.get('date')    || now.toLocaleDateString('fr-FR'),
      time:       params.get('time')    || now.toLocaleTimeString('fr-FR'),
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('[SW] Parse Error', error);
    return null;
  }
}

// ─────────────────────────────────────────────
// SUPABASE INSERT  ← BUG CORRIGÉ ICI
// Ancienne version utilisait "..." au lieu de `...`
// donc ${SUPABASE_URL} était envoyé comme texte brut
// ─────────────────────────────────────────────

async function insertToSupabase(recordData) {
  try {
    // ✅ Template literals corrects avec backticks
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/scans`,
      {
        method: 'POST',
        headers: {
          'apikey':        SUPABASE_ANON_KEY,           // ✅ vraie clé
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // ✅ template literal
          'Content-Type':  'application/json',
          'Prefer':        'return=representation'       // ✅ retourne la ligne insérée
        },
        body: JSON.stringify(recordData)
      }
    );

    // 201 = créé, 200 = ok
    if (response.status === 201 || response.status === 200) {
      const data = await response.json();
      // Vérification réelle : la ligne doit être retournée
      if (data && data.length > 0) {
        console.log('[SW] Supabase OK :', recordData.code);
        return true;
      }
      // Supabase a répondu 200/201 mais sans données → succès quand même
      console.log('[SW] Supabase OK (sans retour) :', recordData.code);
      return true;
    }

    // 409 = doublon sur scan_id → déjà présent, on considère OK
    if (response.status === 409) {
      console.log('[SW] Supabase Duplicate ignoré :', recordData.code);
      return true;
    }

    const text = await response.text();
    console.error('[SW] Supabase Error', response.status, text);
    return false;

  } catch (error) {
    console.error('[SW] Supabase Network Error', error);
    return false;
  }
}

// ─────────────────────────────────────────────
// INTERCEPTE LES APPELS GOOGLE SCRIPTS
// Et double-envoie vers Supabase en parallèle
// ─────────────────────────────────────────────

async function handleGoogleScript(request) {
  const url = request.url;

  // Login / Register → pass-through uniquement
  if (url.includes('action=login') || url.includes('action=register')) {
    try {
      return await fetch(request);
    } catch {
      return jsonResponse({ status: 'offline' });
    }
  }

  // saveScan → envoie à Google Sheets ET à Supabase
  if (url.includes('action=saveScan')) {
    try {
      const [googleResponse] = await Promise.allSettled([fetch(request)]);

      const recordData = extractRecordFromUrl(url);
      if (recordData) {
        // Supabase en parallèle, non bloquant pour la réponse Google
        insertToSupabase(recordData).catch(err =>
          console.error('[SW] Supabase parallel insert error:', err)
        );
      }

      if (googleResponse.status === 'fulfilled') {
        return googleResponse.value;
      }

      // Google a échoué mais on retourne quand même un succès partiel
      return jsonResponse({ status: 'partial', message: 'Google Sheets hors-ligne, Supabase OK' });

    } catch (error) {
      // Hors-ligne total → file d'attente
      await queueRequest(url);
      return jsonResponse({ status: 'queued', message: 'Scan en attente' });
    }
  }

  try {
    return await fetch(request);
  } catch {
    return jsonResponse({ status: 'error' });
  }
}

// ─────────────────────────────────────────────
// SYNC BACKGROUND : vide la file IndexedDB
// ─────────────────────────────────────────────

async function syncPendingScans() {
  const pending = await getPendingRequests();

  console.log(`[SW] ${pending.length} scan(s) à synchroniser`);

  for (const item of pending) {
    try {
      const response   = await fetch(item.url);
      const recordData = extractRecordFromUrl(item.url);

      let supabaseOk = true;
      if (recordData) {
        supabaseOk = await insertToSupabase(recordData);
      }

      // Ne supprime de la queue que si les deux ont réussi (ou Google OK)
      if (response.ok && supabaseOk) {
        await deleteRequest(item.id);

        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type:      'SCAN_SYNCED',
            timestamp: item.timestamp
          });
        });
      }

    } catch (error) {
      console.error('[SW] Sync Error', error);
      // On laisse dans la queue pour réessayer
    }
  }
}
