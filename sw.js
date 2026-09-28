// Metronomo da Palco: fa funzionare l'app anche senza internet.
// Quando pubblichi una nuova versione, cambia il numero qui sotto.
const VERSION = 'metronomo-v2';
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

// Una richiesta di rete che non risponde entro ms millisecondi viene abbandonata
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

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

  // Caratteri di Google: dalla memoria se ci sono, altrimenti rete con limite di 3 secondi
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const c = await caches.open(FONTS);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await withTimeout(fetch(req), 3000);
        c.put(req, res.clone());
        return res;
      } catch (_) {
        return new Response('', { status: 200, headers: { 'Content-Type': url.hostname === 'fonts.googleapis.com' ? 'text/css' : 'font/woff2' } });
      }
    })());
    return;
  }

  if (url.origin !== location.origin) return;

  // File dell'app: subito dalla memoria; se c'è rete si aggiornano in sottofondo
  const isPage = req.mode === 'navigate';
  const net = withTimeout(fetch(req), 4000)
    .then(async res => { if (res && res.ok) { const c = await caches.open(VERSION); await c.put(isPage ? './index.html' : req, res.clone()); } return res; })
    .catch(() => null);
  e.waitUntil(net);
  e.respondWith((async () => {
    const hit = isPage
      ? (await caches.match('./index.html')) || (await caches.match('./'))
      : await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await net;
    return res || new Response('Offline', { status: 503 });
  })());
});
