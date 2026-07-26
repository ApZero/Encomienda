// service-worker.js
// IMPORTANTE: subí CACHE_NAME cada vez que despliegues cambios,
// así Android/Chrome refresca la caché en vez de mostrar la versión vieja.
const CACHE_NAME = 'encomienda-v2';

const ARCHIVOS_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/db.js',
  './js/calc.js',
  './js/util.js',
  './js/backup.js',
  './js/vista-dashboard.js',
  './js/vista-lotes.js',
  './js/vista-productos.js',
  './js/vista-comparar.js',
  './js/vista-ajustes.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARCHIVOS_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(nombres =>
      Promise.all(nombres.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // no cachear peticiones a fuentes externas (Google Fonts) con estrategia de red primero
  if (!event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cacheada => {
      const fetchPromise = fetch(event.request).then(respuestaRed => {
        if (respuestaRed && respuestaRed.status === 200) {
          const clon = respuestaRed.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clon));
        }
        return respuestaRed;
      }).catch(() => cacheada);
      return cacheada || fetchPromise;
    })
  );
});
