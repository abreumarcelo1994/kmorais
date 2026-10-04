/**
 * Service Worker — Kelly Morais UGC Portfolio
 * Cache de ciclo de vida longo, suporte PWA e carregamento instantâneo em visitas repetidas.
 */

const CACHE_NAME = 'kmorais-cache-v1';

// Recursos críticos para pré-cache na instalação
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './cms.js',
  './site.webmanifest',
  './media/hero_poster.webp'
];

// 1. Instalação: baixa e armazena os recursos essenciais no Cache Storage
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 2. Ativação: expurga versões obsoletas de cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Interceptação de Requisições com Estratégias Inteligentes
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca cacheia o painel administrativo, requisições não-GET ou APIs externas dinâmicas
  if (req.method !== 'GET' || url.pathname.includes('admin') || (!url.protocol.startsWith('http'))) {
    return;
  }

  // A. Páginas HTML (Navegação): Network-First com Fallback de Cache
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match('./') || caches.match('./index.html'))
    );
    return;
  }

  // B. Mídias, Imagens e Fontes (/media/*, .webp, .woff2, .png, .jpg): Cache-First
  // Garante resposta instantânea (0ms) e elimina tráfego repetido na rede
  if (url.pathname.includes('/media/') || /\.(webp|png|jpe?g|gif|svg|woff2)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // C. Estilos e Scripts (.css, .js): Stale-While-Revalidate
  // Responde imediatamente do cache e atualiza a cópia em segundo plano
  if (/\.(css|js)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
