// Metronomo da Palco: fa funzionare l'app anche senza internet.
// Quando pubblichi una nuova versione, cambia il numero qui sotto.
const VERSION = 'metronomo-v1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];
const FONTS = 'metronomo-fonts';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Caratteri di Google: salvati alla prima apertura con internet, poi sempre dalla memoria
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONTS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; })))
        .catch(() => new Response('', { status: 204 }))
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // File dell'app: subito dalla memoria, e in sottofondo si aggiorna se c'è rete
  e.respondWith(
    caches.open(VERSION).then(c =>
      c.match(req, { ignoreSearch: true }).then(hit => {
        const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        return net.then(res => res || (req.mode === 'navigate' ? c.match('./index.html') : new Response('', { status: 504 })));
      })
    )
  );
});
