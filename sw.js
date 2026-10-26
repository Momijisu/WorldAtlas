// Offline support: the app shell is pre-cached, then served stale-while-revalidate
// so the app opens instantly (even offline) and picks up new versions on the next launch.
// Bump VERSION when the file list changes.
const VERSION = 'v3';
const CACHE = 'worldatlas-' + VERSION;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/auth.js', 'js/config.js', 'js/db.js', 'js/example.js', 'js/mapview.js',
  'js/markdown.js', 'js/store.js', 'js/sync.js', 'js/util.js',
  'vendor/marked.min.js', 'vendor/purify.min.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('worldatlas-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle our own static files; Microsoft login/Graph traffic goes straight to the network.
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Sign-in redirects come back as ./?code=… — serve the shell for any navigation.
  const key = req.mode === 'navigate' ? './' : req;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const network = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    if (cached) { e.waitUntil(network); return cached; }
    return network;
  }));
});
