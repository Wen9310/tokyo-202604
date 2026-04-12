// sw.js — 東京快閃 2026
// 版本：v2（穩定版）
// 策略：不快取 HTML，只快取字型，其餘走網路
// 不強制 reload 頁面（避免填寫中的表單資料遺失）

const FONT_CACHE = 'tokyo-fonts-v1';

// ── Install：立即接管，不等舊 SW ──────────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── Activate：清除所有舊快取 ─────────────────────────────────
self.addEventListener('activate', async () => {
  const keys = await caches.keys();
  await Promise.all(
    keys.filter(k => k !== FONT_CACHE).map(k => caches.delete(k))
  );
  await self.clients.claim();
  // ✅ 不呼叫 client.navigate()，不強制重整頁面
});

// ── Fetch：分流策略 ───────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Google Fonts → Cache First（字型快取，加速載入）
  if (url.hostname === 'fonts.googleapis.com' ||
      url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(event.request).then(hit => {
          if (hit) return hit;
          return fetch(event.request).then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // GAS API → Network Only（即時資料，絕不快取）
  if (url.hostname === 'script.google.com') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ ok: false, error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // HTML 頁面 → Network First（確保每次都拿到最新 index.html）
  if (event.request.mode === 'navigate' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 其餘資源 → Network First，失敗才用快取
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
