const CACHE_NAME = 'stellantis-mgv-v11.0';
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

self.addEventListener('install', event => {
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => cache.addAll(STATIC_ASSETS))
.then(() => self.skipWaiting())
);
});

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

self.addEventListener('sync', event => {
if (event.tag === SYNC_TAG) {
event.waitUntil(syncPendingScans());
}
});

self.addEventListener('message', event => {
if (!event.data) return;

if (event.data.type === 'SKIP_WAITING') {
self.skipWaiting();
}

if (event.data.type === 'SYNC_NOW') {
event.waitUntil(syncPendingScans());
}
});

self.addEventListener('fetch', event => {
const url = new URL(event.request.url);

if (url.hostname === 'script.google.com') {
event.respondWith(handleGoogleScript(event.request));
return;
}

event.respondWith(cacheFirst(event.request));
});

function jsonResponse(data, status = 200) {
return new Response(
JSON.stringify(data),
{
status,
headers: {
'Content-Type': 'application/json'
}
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
request.onerror = () => reject(request.error);

});
}

async function getPendingRequests() {
const db = await openDB();

return new Promise(resolve => {
const tx = db.transaction(STORE_NAME, 'readonly');

tx.objectStore(STORE_NAME)
  .getAll()
  .onsuccess = event => resolve(event.target.result);

});
}

async function queueRequest(url) {
const existing = await getPendingRequests();

if (existing.some(item => item.url === url)) {
return;
}

const db = await openDB();

return new Promise(resolve => {
const tx = db.transaction(STORE_NAME, 'readwrite');

const store = tx.objectStore(STORE_NAME);

store.add({
  url,
  timestamp: Date.now()
});

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

function extractRecordFromUrl(urlStr) {
try {
const url = new URL(urlStr);
const params = url.searchParams;

const now = new Date();

return {
  scan_id: params.get('scan_id') || crypto.randomUUID(),
  op: params.get('op') || 'UNKNOWN',
  code: params.get('code') || '',
  zone: params.get('zone') || '',
  date: params.get('date') || now.toLocaleDateString('fr-FR'),
  time: params.get('time') || now.toLocaleTimeString('fr-FR')
};

} catch (error) {
console.error('[SW] Parse Error', error);
return null;
}
}

async function insertToSupabase(recordData) {
try {
const response = await fetch(
"${SUPABASE_URL}/rest/v1/scans",
{
method: 'POST',
headers: {
apikey: SUPABASE_ANON_KEY,
Authorization: "Bearer ${SUPABASE_ANON_KEY}",
'Content-Type': 'application/json',
Prefer: 'return=minimal'
},
body: JSON.stringify(recordData)
}
);

if (
  response.status === 201 ||
  response.status === 200
) {
  console.log('[SW] Supabase OK');
  return true;
}

if (response.status === 409) {
  console.log('[SW] Supabase Duplicate');
  return true;
}

const text = await response.text();

console.error(
  '[SW] Supabase Error',
  response.status,
  text
);

return false;

} catch (error) {
console.error(
'[SW] Supabase Network Error',
error
);

return false;

}
}

async function handleGoogleScript(request) {
const url = request.url;

if (
url.includes('action=login') ||
url.includes('action=register')
) {
try {
return await fetch(request);
} catch {
return jsonResponse({
status: 'offline'
});
}
}

if (url.includes('action=saveScan')) {
try {
const response = await fetch(request);

  const recordData =
    extractRecordFromUrl(url);

  if (recordData) {
    await insertToSupabase(recordData);
  }

  return response;

} catch (error) {

  await queueRequest(url);

  return jsonResponse({
    status: 'queued',
    message: 'Scan en attente'
  });
}

}

try {
return await fetch(request);
} catch {
return jsonResponse({
status: 'error'
});
}
}

async function syncPendingScans() {
const pending =
await getPendingRequests();

console.log(
"[SW] ${pending.length} scan(s) à synchroniser"
);

for (const item of pending) {

try {

  const response =
    await fetch(item.url);

  if (!response.ok) {
    continue;
  }

  const recordData =
    extractRecordFromUrl(item.url);

  if (recordData) {

    const success =
      await insertToSupabase(recordData);

    if (!success) {
      continue;
    }
  }

  await deleteRequest(item.id);

  const clients =
    await self.clients.matchAll();

  clients.forEach(client => {
    client.postMessage({
      type: 'SCAN_SYNCED',
      timestamp: item.timestamp
    });
  });

} catch (error) {

  console.error(
    '[SW] Sync Error',
    error
  );
}

}
}
