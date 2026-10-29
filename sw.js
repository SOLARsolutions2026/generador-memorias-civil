// Service worker mínimo: permite instalar la app y guarda los archivos propios.
// Los datos siempre se piden en vivo a Supabase.
const CACHE = 'memorias-v90';
const ARCHIVOS = ['./', 'index.html', 'app.css', 'app.js', 'config.js', 'calc/anexoA.js', 'anexoA-ui.js', 'calc/anexoB.js', 'anexoB-ui.js', 'calc/combos.js', 'combos-ui.js', 'calc/anexoC.js', 'anexoC-ui.js', 'data/perfiles.js', 'calc/anexoD.js', 'anexoD-ui.js', 'calc/concreto.js', 'calc/sugerencias.js', 'anexoDc-ui.js', 'calc/anexoE.js', 'anexoE-ui.js', 'memoria-ui.js', 'calc/carta.js', 'documentos-ui.js', 'ejes-ui.js', 'respaldo-ui.js', 'variantes-ui.js', 'calc/correas.js', 'revision-ui.js', 'img/ref-incision.jpg', 'img/ref-conjunta.jpg', 'img/ref-grano.jpg', 'vendor/fflate.min.js', 'vendor/supabase.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo-pe.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // Red primero (para recibir mejoras), caché si no hay conexión
  // cache:'no-cache' obliga a preguntar al servidor si hay versión nueva (GitHub guarda copias 10 min)
  e.respondWith(fetch(e.request, { cache:'no-cache' }).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});
