// ═══════════════════════════════════════════════════════════
//  Service Worker — 東京快閃 2026
//  儲存為 sw.js，放在網站根目錄
// ═══════════════════════════════════════════════════════════

const CACHE_NAME  = 'tokyo-trip-v1';
const FONT_CACHE  = 'tokyo-fonts-v1';

// 預快取的核心資源
const CORE_ASSETS = [
  '/',
  '/index.html',       // 部署後通常是 index.html
  '/manifest.json',
];

// Google Fonts（特別處理）
const FONT_ORIGINS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// ── Install：預快取核心資源 ──────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── Activate：清除舊版快取 ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== FONT_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch：策略分流 ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts → Cache First
  if (FONT_ORIGINS.some(o => url.origin === new URL(o).origin)) {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(hit => {
          if (hit) return hit;
          return fetch(event.request).then(res => {
            cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // GAS API → Network Only（需要即時資料，不快取）
  if (event.request.url.includes('script.google.com')) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ ok: false, error: 'offline' }), { headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }

  // 主要 HTML/CSS/JS → Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request)
          .then(res => { if (res.ok) cache.put(event.request, res.clone()); return res; })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});
