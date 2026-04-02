const CACHE_NAME = 'mgv-scan-v1';
// تأكد من أن أسماء الملفات هنا تطابق ما لديك في GitHub تماماً
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './IMG_20260328_193404.png', 
  'https://unpkg.com/html5-qrcode',
  'https://cdn.tailwindcss.com'
];

// مرحلة التثبيت: حفظ الملفات في الهاتف
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching assets...');
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// مرحلة التشغيل: القراءة من الذاكرة أولاً دائماً
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // إذا وجد الملف في الذاكرة نرجعه، وإلا نطلبه من الإنترنت
      return response || fetch(event.request);
    }).catch(() => {
        // إذا فشل كل شيء (أوفلاين والملف غير موجود)
        return caches.match('./index.html');
    })
  );
});
