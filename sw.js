/* 夜读 Service Worker — v4：核心资源 network-first，避免卡在旧版本 */
const CACHE = "yedu-v9";
const SHELL = [
  './', './index.html', './index.html?v=9',
  './styles.css?v=9', './stories.js?v=9', './books.js?v=9', './covers.js?v=9', './app.js?v=9',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // 音频：cache-first（大文件，缓存后离线可听）
  if (url.pathname.includes('/audio/') || url.pathname.includes('/books/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }))
    );
    return;
  }

  // 核心资源（HTML/JS/CSS/图标）：network-first，保证拿到最新版本
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
