// Orb Seeker service worker: makes the game load offline after the first visit.
// Bump CACHE whenever you deploy so players get the new version.
//
// Note: since moving to Vite, the game's JS and CSS are built into ./assets/
// with hashed filenames that change every build, so they cannot be listed here
// by name. They are picked up by the runtime cache in the fetch handler below
// the first time they are requested. Three.js is bundled into that JS now, so
// the old r128 CDN entry is gone.
const CACHE = 'orb-seeker-v2';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res;
    }).catch(() => caches.match('./index.html')))
  );
});
