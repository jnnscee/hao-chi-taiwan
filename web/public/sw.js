/* Hao Chi Taiwan — service worker (offline / PWA slice).
 *
 * Hand-written, no build step: this file is served as-is from
 * public/. Bump SW_VERSION on every change to this file (and on
 * any slice whose pages must not be served from an old cache);
 * the activate handler deletes every older hao-chi-* cache.
 *
 * Strategy, by request kind:
 *  - Pages (navigations and Next's RSC data fetches): network-first,
 *    so online visitors keep today's ISR freshness (admin edits show
 *    within ~60 s); the cached copy is the offline fallback, and a
 *    navigation that was never cached gets /offline.html.
 *  - Static assets (/_next/static, icons, manifest, fonts…):
 *    stale-while-revalidate.
 *  - OpenStreetMap tiles: cache-first into a capped runtime cache
 *    (~200 tiles, oldest evicted), so areas already viewed keep
 *    working offline.
 *  - NEVER cached, always network-only: /admin, every Supabase
 *    request (place data + auth), any non-GET request, and any
 *    other cross-origin request. The admin area and the auth/data
 *    layer must never be served from, or written into, a cache.
 */

const SW_VERSION = "pwa-2";
const PRECACHE = `hao-chi-precache-${SW_VERSION}`;
const PAGES = `hao-chi-pages-${SW_VERSION}`;
const STATIC = `hao-chi-static-${SW_VERSION}`;
const TILES = `hao-chi-tiles-${SW_VERSION}`;
const TILE_LIMIT = 200;
const OFFLINE_URL = "/offline.html";

/* The offline core: the two home pages, the info/contact pages in
 * both languages, the fallback page, the manifest and the icons.
 * Canonical paths (Next serves /zh, not /zh/; lookups below also
 * try the other slash form). The 484 place pages are deliberately
 * NOT precached — they runtime-cache as they are visited. */
const PRECACHE_URLS = [
  "/",
  "/zh",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/zh/about",
  "/zh/privacy",
  "/zh/terms",
  "/zh/contact",
  OFFLINE_URL,
  "/banner.jpg",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
  "/icons/192",
  "/icons/maskable-512",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (err) {
        // addAll is all-or-nothing: one bad URL must not sink the
        // whole offline core, so fall back to adding one by one.
        await Promise.all(
          PRECACHE_URLS.map(async (url) => {
            try {
              await cache.add(url);
            } catch (e) {
              /* that one URL simply won't be precached */
            }
          })
        );
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PRECACHE, PAGES, STATIC, TILES]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("hao-chi-") && !keep.has(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

/** Cache lookup that also tries the bare path (no query string) and
 * the other trailing-slash form, so /?place=r6 deep links and /zh
 * vs /zh/ still find the cached page offline. */
async function matchAny(cache, request) {
  const direct = await cache.match(request);
  if (direct) return direct;
  const url = new URL(request.url);
  const bare = url.origin + url.pathname;
  const alt = bare.endsWith("/") ? bare.slice(0, -1) : bare + "/";
  for (const candidate of [bare, alt]) {
    if (!candidate) continue;
    const hit = await cache.match(candidate);
    if (hit) return hit;
  }
  return undefined;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
      if (request.mode === "navigate") {
        // Also warm the bare path, so a visit that arrived with a
        // query string (?place=…, ?lang=…) leaves the plain page
        // cached for offline visits too.
        const url = new URL(request.url);
        cache.put(url.origin + url.pathname, fresh.clone());
      }
    }
    return fresh;
  } catch (err) {
    const hit =
      (await matchAny(cache, request)) ||
      (await matchAny(await caches.open(PRECACHE), request));
    if (hit) return hit;
    if (request.mode === "navigate") {
      const offline = await caches.match(OFFLINE_URL);
      if (offline) return offline;
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC);
  const hit =
    (await cache.match(request)) ||
    (await (await caches.open(PRECACHE)).match(request));
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit || (await network) || Response.error();
}

async function trimTiles(cache) {
  const keys = await cache.keys();
  const excess = keys.length - TILE_LIMIT;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

async function tileFirst(request) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      cache.put(request, fresh.clone());
      trimTiles(cache);
    }
    return fresh;
  } catch (err) {
    return new Response("", { status: 504, statusText: "Tile unavailable offline" });
  }
}

const STATIC_EXTENSIONS = new Set([
  "js", "css", "png", "jpg", "jpeg", "gif", "svg", "webp", "ico",
  "woff", "woff2", "ttf", "otf", "json", "txt",
]);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  /* --- Never cache --- */
  // The service worker's own script: the browser's update check
  // must always see the network copy.
  if (url.pathname === "/sw.js") return;
  // The admin area (sign-in + place manager) is network-only.
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return;
  // Supabase serves the place data and all of auth: network-only.
  if (url.hostname === "supabase.co" || url.hostname.endsWith(".supabase.co")) return;

  /* --- Map tiles: cache-first, capped --- */
  if (url.hostname === "tile.openstreetmap.org") {
    event.respondWith(tileFirst(request));
    return;
  }

  /* Any other cross-origin request: network-only (not intercepted). */
  if (url.origin !== self.location.origin) return;

  /* --- Pages: network-first --- */
  const accept = request.headers.get("Accept") || "";
  const isPage =
    request.mode === "navigate" ||
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-State-Tree") != null ||
    accept.includes("text/html");
  if (isPage) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  /* --- Static assets: stale-while-revalidate --- */
  const extension = url.pathname.split(".").pop().toLowerCase();
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon" ||
    url.pathname === "/manifest.webmanifest" ||
    STATIC_EXTENSIONS.has(extension);
  if (isStatic) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  /* Anything else (API routes and the like): network-only. */
});
