// Offline support: the app shell is pre-cached, then served stale-while-revalidate
// so the app opens instantly (even offline) and picks up new versions on the next launch.
// The cache is named after the app version in js/version.js; bump that on release,
// and keep SHELL in step when files are added or removed.
importScripts('js/version.js');
const CACHE = 'worldatlas-' + self.WA_VERSION;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'css/features.css', 'css/graph.css',
  'css/maps.css', 'js/app.js', 'js/auth.js', 'js/backgrounds.js', 'js/preview.js', 'js/focus.js', 'js/scripts.js', 'js/dropzone.js', 'js/calendar.js', 'js/config.js', 'js/db.js', 'js/example.js',
  'js/guidance.js', 'js/icons.js', 'js/importer.js', 'js/mapview.js', 'js/markdown.js', 'js/prompts.js', 'js/relations.js', 'js/store.js', 'js/sync.js', 'js/templates.js',
  'js/ui.js', 'js/util.js', 'js/version.js', 'js/views/article.js', 'js/views/calendar.js', 'js/views/conflict.js', 'js/views/editor.js',
  'js/views/graph.js', 'js/views/history.js', 'js/views/home.js', 'js/views/list.js', 'js/views/maps.js', 'js/views/prompts.js',
  'js/views/settings.js', 'js/views/timeline.js', 'js/views/tree.js', 'vendor/marked.min.js',
  'vendor/purify.min.js', 'vendor/live-editor.js', 'fonts/alegreya-latin-400-italic.woff2', 'fonts/alegreya-latin-400-normal.woff2',
  'fonts/alegreya-latin-700-italic.woff2', 'fonts/alegreya-latin-700-normal.woff2',
  'fonts/alegreya-sans-latin-400-italic.woff2', 'fonts/alegreya-sans-latin-400-normal.woff2',
  'fonts/alegreya-sans-latin-500-normal.woff2', 'fonts/alegreya-sans-latin-700-normal.woff2',
  'fonts/cormorant-garamond-latin-500-italic.woff2', 'fonts/cormorant-garamond-latin-500-normal.woff2',
  'fonts/cormorant-garamond-latin-600-normal.woff2', 'fonts/cormorant-garamond-latin-700-normal.woff2',
  'fonts/cedarville-cursive-latin-400-normal.woff2', 'fonts/kalam-latin-400-normal.woff2',
  'fonts/cormorant-garamond-latin-400-normal.woff2', 'fonts/cormorant-garamond-latin-400-italic.woff2',
  'fonts/alegreya-latin-500-normal.woff2', 'fonts/alegreya-latin-500-italic.woff2',
  'fonts/alegreya-sans-latin-300-normal.woff2', 'fonts/alegreya-sans-latin-300-italic.woff2',
  'assets/demo/map.svg', 'assets/demo/cover.svg', 'assets/demo/varenhold.svg', 'assets/demo/gloamwood.svg', 'assets/backgrounds/parchment.png', 'assets/backgrounds/noise.png', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser's HTTP cache, so a new version never
  // installs with stale copies of files from the previous one.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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
  // Update checks must always reach the network and never be cached.
  if (url.searchParams.has('check')) return;
  // Sign-in redirects come back as ./?code=… — serve the shell for any navigation.
  const key = req.mode === 'navigate' ? './' : req;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const network = fetch(req.url, { cache: 'no-cache' }).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    if (cached) { e.waitUntil(network); return cached; }
    return network;
  }));
});
