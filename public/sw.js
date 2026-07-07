const CACHE_VERSION = "graph-pixel-maker-v39";
const OFFLINE_SESSION_MARKER = "/__graph-pixel-offline-session";
const OFFLINE_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const OFFLINE_SESSION_READY_MESSAGE = "GRAPH_PIXEL_OFFLINE_SESSION_READY";
const OFFLINE_SESSION_CLEAR_MESSAGE = "GRAPH_PIXEL_OFFLINE_SESSION_CLEAR";
const PROTECTED_PREFIXES = ["/dashboard", "/projects", "/settings"];
const BLOCKED_OFFLINE_NAVIGATION_PATHS = ["/projects/new"];
const APP_SHELL = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192x192.svg",
  "/icons/icon-512x512.svg",
  "/icons/maskable-icon.svg",
];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isBlockedOfflineNavigation(pathname) {
  return BLOCKED_OFFLINE_NAVIGATION_PATHS.some((blockedPath) => pathname === blockedPath || pathname.startsWith(`${blockedPath}/`));
}

function isEditableProjectPath(pathname) {
  return pathname.startsWith("/projects/") && !isBlockedOfflineNavigation(pathname);
}

function isCacheableEditorNavigation(url, response) {
  if (!isEditableProjectPath(url.pathname)) return false;
  if (!response || response.status !== 200 || response.type !== "basic" || response.redirected) return false;

  try {
    const responseUrl = new URL(response.url);
    return responseUrl.origin === self.location.origin && responseUrl.pathname === url.pathname;
  } catch {
    return true;
  }
}

function shouldUseCachedEditorNavigation(url, response) {
  if (!isEditableProjectPath(url.pathname) || !response) return false;
  if (response.status >= 500) return true;

  try {
    const responseUrl = new URL(response.url);
    return response.redirected && responseUrl.origin === self.location.origin && responseUrl.pathname === "/login";
  } catch {
    return false;
  }
}

async function hasFreshOfflineSession(cache) {
  const marker = await cache.match(OFFLINE_SESSION_MARKER);
  if (!marker) return false;

  const cachedAt = marker.headers.get("x-cached-at");
  const cachedAtTime = cachedAt ? Date.parse(cachedAt) : 0;
  const expiresAt = marker.headers.get("x-expires-at");
  const expiresAtTime = expiresAt ? Date.parse(expiresAt) : 0;
  if (
    !cachedAtTime ||
    !expiresAtTime ||
    Date.now() >= expiresAtTime ||
    Date.now() - cachedAtTime > OFFLINE_SESSION_MAX_AGE_MS
  ) {
    await cache.delete(OFFLINE_SESSION_MARKER);
    await deleteProtectedNavigations(cache);
    return false;
  }

  return true;
}

async function findCachedNavigation(cache, url, request) {
  const exact = await cache.match(request);
  if (exact) return exact;

  const requests = await cache.keys();
  for (const cachedRequest of requests) {
    const cachedUrl = new URL(cachedRequest.url);
    if (cachedUrl.origin === url.origin && cachedUrl.pathname === url.pathname) {
      const cached = await cache.match(cachedRequest);
      if (cached) return cached;
    }
  }

  return null;
}

async function deleteProtectedNavigations(cache) {
  const requests = await cache.keys();
  await Promise.all(
    requests
      .filter((request) => isProtectedPath(new URL(request.url).pathname))
      .map((request) => cache.delete(request)),
  );
}

async function deleteBlockedOfflineNavigations(cache) {
  const requests = await cache.keys();
  await Promise.all(
    requests
      .filter((request) => isBlockedOfflineNavigation(new URL(request.url).pathname))
      .map((request) => cache.delete(request)),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => caches.open(CACHE_VERSION))
      .then((cache) => deleteBlockedOfflineNavigations(cache))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === OFFLINE_SESSION_READY_MESSAGE) {
    const cachedAt = typeof event.data.cachedAt === "string" ? event.data.cachedAt : new Date().toISOString();
    const expiresAt = typeof event.data.expiresAt === "string" ? event.data.expiresAt : "";
    event.waitUntil(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.put(
          OFFLINE_SESSION_MARKER,
          new Response(
            JSON.stringify({
              version: 1,
              cachedAt,
              expiresAt,
              userId: typeof event.data.userId === "string" ? event.data.userId : null,
            }),
            {
              headers: {
                "cache-control": "no-store",
                "content-type": "application/json",
                "x-cached-at": cachedAt,
                "x-expires-at": expiresAt,
              },
            },
          ),
        ).catch(() => {}),
      ),
    );
    return;
  }

  if (event.data?.type === OFFLINE_SESSION_CLEAR_MESSAGE) {
    event.waitUntil(
      caches.open(CACHE_VERSION).then(async (cache) => {
        await cache.delete(OFFLINE_SESSION_MARKER);
        await deleteProtectedNavigations(cache);
      }),
    );
  }
});

async function handleNavigation(event, request, url) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request);
    if (shouldUseCachedEditorNavigation(url, response) && (await hasFreshOfflineSession(cache))) {
      const cached = await findCachedNavigation(cache, url, request);
      if (cached) return cached;
    }

    if (isCacheableEditorNavigation(url, response)) {
      event.waitUntil(cache.put(request, response.clone()).catch(() => {}));
    }
    return response;
  } catch {
    if (isEditableProjectPath(url.pathname) && (await hasFreshOfflineSession(cache))) {
      const cached = await findCachedNavigation(cache, url, request);
      if (cached) return cached;
    }

    return (await cache.match("/offline")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event, request, url));
    return;
  }

  if (!APP_SHELL.includes(url.pathname)) return;

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
