/*
 * Service worker of the web interface. Two jobs:
 *  - installability and a fast start: the app shell (index.html plus the hashed files under /assets) is cached;
 *  - an offline page that is not a browser error: without network, navigations get the cached shell, which then
 *    shows its own "no connection" handling.
 * Never cached: /api (incl. the WebSocket), /kratos (sessions, flows) and everything that is not a GET.
 * Web push (needs HTTPS and a real domain) would add 'push' and 'notificationclick' handlers here.
 */
const CACHE = 'smarthome-shell-v1';
const SHELL = ['/', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/kratos')) {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstShell(request));
    return;
  }
  // Hashed build files never change: cache first. Everything else (icons, manifest): from cache, refreshed behind it.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function networkFirstShell(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put('/', response.clone());
    }
    return response;
  } catch {
    return (await cache.match('/')) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) {
    return hit;
  }
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return hit ?? (await network) ?? Response.error();
}
