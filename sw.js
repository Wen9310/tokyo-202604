// sw.js — 清除所有舊快取並立即自我銷毀
// 上傳這個檔案到 GitHub，覆蓋舊的 sw.js

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  // 刪除所有快取
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  // 讓所有頁面立即使用新版
  await self.clients.claim();
  // 通知頁面重新整理
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(client => client.navigate(client.url));
});

self.addEventListener('fetch', event => {
  // 完全不快取，直接走網路
  event.respondWith(fetch(event.request));
});
