const CACHE_NAME = "rook-lite-shell-v5";
const BASE_URL = new URL("./", self.registration.scope);
const appUrl = (path) => new URL(path, BASE_URL).toString();
const APP_SHELL = ["./", "index.html", "logo.png", "empty-notes.png", "manifest.webmanifest"].map(appUrl);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Pre-cache app shell assets safely
      await Promise.allSettled(
        APP_SHELL.map((url) =>
          fetch(url).then((res) => {
            if (res.ok) return cache.put(url, res);
          }).catch((err) => console.warn("Failed to pre-cache shell url:", url, err))
        )
      );

      // 2. Extract and cache bundled production assets
      try {
        const response = await fetch(appUrl("./"));
        if (response.ok) {
          const copy = response.clone();
          await cache.put(appUrl("./"), copy);
          await cache.put(appUrl("index.html"), response.clone());
          const html = await response.text();
          const matches = [...html.matchAll(/(?:src|href)="([^"]*(?:assets\/|\/src\/|@vite\/)[^"]+)"/g)];
          const assets = matches.map((match) => new URL(match[1], BASE_URL).toString());
          await Promise.allSettled(
            assets.map(async (assetUrl) => {
              try {
                const res = await fetch(assetUrl);
                if (res.ok) await cache.put(assetUrl, res);
              } catch (err) {
                console.warn("Failed to pre-cache asset:", assetUrl, err);
              }
            })
          );
        }
      } catch (err) {
        console.warn("Install fetch error:", err);
      }
    })
  );
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
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation requests (HTML pages)
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => {
              void cache.put(appUrl("./"), copy.clone());
              void cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(async () => {
          // Robust offline fallback chain for HTML navigation
          const exact = await caches.match(event.request, { ignoreSearch: true });
          if (exact) return exact;
          const root = await caches.match(appUrl("./"), { ignoreSearch: true });
          if (root) return root;
          const index = await caches.match(appUrl("index.html"), { ignoreSearch: true });
          if (index) return index;
          return caches.match("./");
        })
    );
    return;
  }

  // Static assets, scripts, stylesheets, images
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => {
          // If offline and request failed, try matching with ignoreSearch
          const fallback = await caches.match(event.request, { ignoreSearch: true });
          if (fallback) return fallback;
          return new Response("", { status: 408, statusText: "Offline" });
        });
    })
  );
});
