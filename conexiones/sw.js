// Service worker de la app de conexiones (alcance /conexiones/): red primero, caché si no hay conexión.
const CACHE = 'conexiones-v5';
const ARCHIVOS = ['./', 'index.html', 'app.css', 'app.js', 'calc.js', 'manifest.webmanifest',
  '../app.css', '../config.js', '../vendor/supabase.js', '../data/perfiles.js', '../icons/icon-192.png', '../icons/icon-512.png', '../icons/logo-pe.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('conexiones-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache:'no-cache' }).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});
