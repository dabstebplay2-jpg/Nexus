const CACHE = 'nexus-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html');
        return (
          cached ||
          new Response(
            '<!DOCTYPE html><html lang="ru"><body style="background:#08080a;color:#e4e4e7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh"><p>Нет сети. Откройте Nexus при подключении к интернету.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        );
      })
    );
  }
});
