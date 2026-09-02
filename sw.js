// Orb Seeker service worker: makes the game load offline after the first visit.
//
// You should not have to touch this file when you deploy. Here is why it works
// without a version bump, which the previous version did require.
//
// Vite builds your code into ./assets/ with a hash in the filename, like
// index-T6S5xPUS.js. Change one line of code and the hash changes, so the file
// name is effectively a version number. Two consequences:
//
//   - Those hashed files can be cached forever. If the name matches, the
//     content matches. Cache-first is always correct for them.
//   - index.html is the one file whose name never changes, and it is what
//     points at the current hashed files. So it must NEVER be served from
//     cache while the network is available, or you get an old index.html
//     pointing at assets that no longer exist.
//
// That is the bug this file used to have: it served everything cache-first,
// including index.html, so a deployed update was invisible until the cache
// name changed by hand. Forget that step once and players are stuck on an old
// version with no clue why.
//
// The strategy below is therefore split:
//   navigations  -> network first, fall back to cache when offline
//   everything else -> cache first, fetch and store on a miss
const CACHE = 'orb-seeker-v3';

// The shell that lets the game boot with no network at all.
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // A "navigation" is the browser loading the page itself, i.e. index.html.
  // Always try the network first so a fresh deploy is picked up immediately;
  // fall back to the cached copy only when there is genuinely no network.
  if (e.request.mode === 'navigate'){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else: hashed assets and icons. Safe to serve from cache.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
