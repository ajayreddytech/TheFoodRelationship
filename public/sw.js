// Minimal service worker. Its presence lets Chrome treat the site as an
// installable app (so the home-screen icon opens standalone, without the
// browser bar). It deliberately does NOT cache anything, so app data and
// new deployments are always fetched fresh from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
