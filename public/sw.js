// 自毁式 service worker - v3 终极版
// 在 install 阶段就开始清理，更激进
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (e) {}
      }
    } catch (e) {}
  })());
});

// fetch handler 必须存在但不拦截任何请求 - 直接走网络
self.addEventListener('fetch', (e) => {
  // 不调用 e.respondWith()，浏览器会默认走网络
});
