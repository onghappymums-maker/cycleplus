// Cycle+ par Happy Mum's — Service Worker v3
const CACHE = 'cycleplus-v3';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Installation — met en cache les assets de base
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting()) // force l'activation immédiate
  );
});

// Activation — supprime les vieux caches automatiquement
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // prend le contrôle immédiatement
  );
});

// Fetch — réseau d'abord, cache en fallback
self.addEventListener('fetch', e => {
  // Toujours réseau pour les APIs externes
  if (
    e.request.url.includes('supabase.co') ||
    e.request.url.includes('anthropic.com') ||
    e.request.url.includes('netlify') ||
    e.request.url.includes('dicebear.com') ||
    e.request.url.includes('googleapis.com') ||
    e.request.url.includes('googletagmanager.com') ||
    e.request.url.includes('cdnjs.cloudflare.com')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Pour index.html — réseau d'abord pour avoir toujours la dernière version
  if (e.request.url.endsWith('/') || e.request.url.includes('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Pour les autres assets — cache d'abord
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});
