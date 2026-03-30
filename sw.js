// ═══════════════════════════════════════════════════════════════
//  Service Worker v2 — 東京快閃 2026
//  ⚠️ 檔案必須放在 index.html 的同層目錄（專案根目錄）
//     才能控制整個 scope
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'tokyo-trip-v2';
const FONT_CACHE = 'tokyo-fonts-v1';

// 核心預快取清單（路徑相對於 sw.js 所在目錄）
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // 逐一快取，單個失敗不影響整體
        return Promise.allSettled(
          CORE_ASSETS.map(url => cache.add(url).catch(e => console.warn('Cache skip:', url, e)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ── Activate：清除舊版 ────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== FONT_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch 策略 ────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Google Fonts → Cache First（字體不常變動）
  if (url.origin === 'https://fonts.googleapis.com' ||
      url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(request).then(hit => hit || fetch(request).then(res => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // GAS API → Network Only（需要即時資料）
  if (url.origin === 'https://script.google.com') {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ ok: false, error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Google Maps 外部連結 → Network Only
  if (url.origin === 'https://maps.google.com') {
    event.respondWith(fetch(request).catch(() => new Response('offline')));
    return;
  }

  // 其餘本地資源 → Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(request).then(cached => {
        const networkFetch = fetch(request).then(res => {
          if (res.ok && request.method === 'GET') {
            cache.put(request, res.clone());
          }
          return res;
        }).catch(() => cached || new Response('Network error', { status: 503 }));
        return cached || networkFetch;
      })
    )
  );
});
