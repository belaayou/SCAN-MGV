// تعريف اسم الذاكرة التخزينية
const CACHE_NAME = 'mgv-scan-cache-v1';

// الملفات التي سيتم تخزينها للعمل بدون إنترنت
const urlsToCache = [
  './index.html',
  './IMG_20260328_193404.png.jpg',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/html5-qrcode'
];

// خطوة التثبيت: حفظ الملفات في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// خطوة التعامل مع الطلبات: تقديم النسخة المخزنة إن وجدت
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
