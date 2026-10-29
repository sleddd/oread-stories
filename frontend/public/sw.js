// Oread's service worker: makes the installed app open quickly and still open offline.
//
// What it keeps, and why:
// - Built scripts and styles (/assets/…) are named by their content, so a kept copy is always
//   right: served from the device first.
// - Pages are fetched fresh first, so a new deploy shows at once; the last copy is the fallback
//   when offline.
// - Icons and the manifest: the kept copy is served, and refreshed in the background.
// - The API and sign-in (/api/…) are never touched. Stories, memories, sessions and keys always
//   come from the server and are never stored on the device.

const CACHE_VERSION = "oread-v1";
const APP_SHELL_PATH = "/";
const NEVER_CACHED_PREFIX = "/api/";
const HASHED_ASSETS_PREFIX = "/assets/";
const STARTER_FILES = [APP_SHELL_PATH, "/manifest.webmanifest", "/icon-192.png", "/favicon-64.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(STARTER_FILES)));
  self.skipWaiting();
});

// Clears caches from older versions of this file.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const oldCacheNames = cacheNames.filter((cacheName) => cacheName !== CACHE_VERSION);
      return Promise.all(oldCacheNames.map((cacheName) => caches.delete(cacheName)));
    }),
  );
  self.clients.claim();
});

function isOwnOrigin(url) {
  return url.origin === self.location.origin;
}

async function rememberResponse(request, response) {
  if (response.ok) {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

async function fromDeviceFirst(request) {
  const keptResponse = await caches.match(request);
  if (keptResponse) {
    return keptResponse;
  }
  return rememberResponse(request, await fetch(request));
}

async function fromNetworkFirst(request) {
  try {
    return await rememberResponse(request, await fetch(request));
  } catch (offlineError) {
    const keptPage = (await caches.match(request)) ?? (await caches.match(APP_SHELL_PATH));
    if (keptPage) {
      return keptPage;
    }
    throw offlineError;
  }
}

async function fromDeviceThenRefresh(request) {
  const keptResponse = await caches.match(request);
  const freshResponse = fetch(request)
    .then((response) => rememberResponse(request, response))
    .catch(() => keptResponse);
  return keptResponse ?? freshResponse;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    !isOwnOrigin(url) ||
    url.pathname.startsWith(NEVER_CACHED_PREFIX)
  ) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fromNetworkFirst(request));
    return;
  }
  if (url.pathname.startsWith(HASHED_ASSETS_PREFIX)) {
    event.respondWith(fromDeviceFirst(request));
    return;
  }
  event.respondWith(fromDeviceThenRefresh(request));
});
