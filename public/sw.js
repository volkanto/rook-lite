const CACHE_NAME = "rook-lite-shell-v3";
const BASE_URL = new URL("./", self.registration.scope);
const appUrl = (path) => new URL(path, BASE_URL).toString();
const APP_SHELL = ["./", "logo.png", "empty-notes.png", "manifest.webmanifest"].map(appUrl);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    const response = await fetch(appUrl("./"));
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)]
      .map((match) => new URL(match[1], BASE_URL).toString());
    if (assets.length) await cache.addAll(assets);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(appUrl("./"), copy));
          return response;
        })
        .catch(() => caches.match(appUrl("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
