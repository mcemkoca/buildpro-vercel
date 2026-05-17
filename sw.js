// BuildPro Service Worker
// Cache-first for static assets, network-first for dynamic content

const CACHE_NAME = 'buildpro-v1';
const STATIC_CACHE = 'buildpro-static-v1';

const STATIC_ASSETS = [
  '/buildpro-vercel/',
  '/buildpro-vercel/index.html',
  '/buildpro-vercel/login.html',
  '/buildpro-vercel/dashboard.html',
  '/buildpro-vercel/buildpro-projects.html',
  '/buildpro-vercel/buildpro-staff.html',
  '/buildpro-vercel/buildpro-equipment.html',
  '/buildpro-vercel/buildpro-quotes.html',
  '/buildpro-vercel/buildpro-site.html',
  '/buildpro-vercel/buildpro-costs.html',
  '/buildpro-vercel/buildpro-calendar.html',
  '/buildpro-vercel/css/main.css',
  '/buildpro-vercel/css/components.css',
  '/buildpro-vercel/css/dashboard.css',
  '/buildpro-vercel/manifest.json',
  '/buildpro-vercel/assets/icon-192.png',
  '/buildpro-vercel/assets/icon-512.png'
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some assets:', err);
        return Promise.resolve();
      });
    })
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for static, network-first for API/data
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and external URLs
  if (request.method !== 'GET' || !url.pathname.startsWith('/buildpro-vercel/')) {
    return;
  }

  // HTML pages — network first, fallback to cache
  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(
              '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BuildPro - Çevrimdışı</title><style>body{font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0;text-align:center;}</style></head><body><div><h1>🏗️ Çevrimdışı Mod</h1><p>Bu sayfa daha önce ziyaret edilmemiş.<br>Lütfen internet bağlantınızı kontrol edin.</p><a href="/buildpro-vercel/index.html" style="color:#f59e0b;text-decoration:none;">Ana Sayfaya Dön</a></div></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        })
    );
    return;
  }

  // Static assets (CSS, JS, images, fonts) — cache first
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.match(/\.(css|js|png|jpg|jpeg|svg|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Default — network with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Background Sync placeholder
self.addEventListener('sync', (event) => {
  if (event.tag === 'buildpro-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_COMPLETE' }));
      })
    );
  }
});

// Push notification placeholder
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'BuildPro', {
        body: data.body || 'Yeni bildirim',
        icon: '/buildpro-vercel/assets/icon-192.png',
        badge: '/buildpro-vercel/assets/icon-72.png',
        tag: data.tag || 'buildpro-default'
      })
    );
  }
});
