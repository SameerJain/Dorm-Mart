/* Dedicated push worker: no page caching or offline interception. */
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch (_) {}
  event.waitUntil(self.registration.showNotification(payload.title || "Dorm Mart", {
    body: payload.body || "You have an update on Dorm Mart.",
    tag: payload.tag || "dorm-mart-update",
    icon: new URL("web-app-manifest-192x192.png", self.registration.scope).href,
    data: { path: payload.path },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path;
  const target = new URL(self.registration.scope);
  target.hash = typeof path === "string" && /^\/app(?:[/?]|$)/.test(path) ? path : "/app/notification";
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope)) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
