/**
 * sw.js — DocVault Service Worker
 * Strategy: Cache-first for static assets, network-first for API calls
 */

const CACHE_NAME    = "docvault-v7";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/firebase-config.js",
  "./js/utils.js",
  "./js/auth.js",
  "./js/users.js",
  "./js/tags.js",
  "./js/offices.js",
  "./js/documents.js",
  "./js/audit.js",
  "./js/search.js",
  "./js/events.js",
  "./js/app.js",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css",
  "https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap"
];

// ── Install: cache static assets ─────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(e => console.warn("Cache addAll partial fail:", e)))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ──────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for static, network-first for rest ─
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, chrome-extension, Firebase API calls
  if (request.method !== "GET") return;
  if (url.hostname.includes("firestore.googleapis.com")) return;
  if (url.hostname.includes("identitytoolkit.googleapis.com")) return;
  if (url.hostname.includes("securetoken.googleapis.com")) return;
  if (url.hostname.includes("drive.google.com")) return;

  // Static assets: cache first
  const isStatic = STATIC_ASSETS.some(a => request.url.includes(a)) ||
                   url.hostname.includes("jsdelivr.net") ||
                   url.hostname.includes("cloudflare.com") ||
                   url.hostname.includes("fonts.googleapis.com") ||
                   url.hostname.includes("fonts.gstatic.com");

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => caches.match("./index.html"));
      })
    );
  } else {
    // Network first, fall back to cache
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
