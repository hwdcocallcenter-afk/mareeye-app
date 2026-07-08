// Mareeye service worker — app-ka shell-kiisa wuu kaydiyaa si uu offline u furmo.
// (Baaritaanka AI-ga wuxuu weli u baahan yahay internet, laakiin app-ku wuu furmayaa.)
const CACHE = 'mareeye-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.url.includes('/api/')) return;          // wicitaannada AI ha kaydin
  e.respondWith(caches.match(request).then(r => r || fetch(request)));
});
