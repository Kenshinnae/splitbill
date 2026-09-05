/* Minimal service worker — PWA install + local notifications. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Bypass previously cached HTML that references assets from an older deployment.
// Only full document navigations are handled: uploads, API, RSC and assets stay native.
// No forced reload on activation: existing forms/uploads must not be interrupted.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin) return;
  url.searchParams.set("__sb_release", "startup-recovery-20260905");
  event.respondWith(fetch(new Request(url, { headers: request.headers, credentials: "same-origin", redirect: "follow", cache: "no-store" })));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    }),
  );
});
