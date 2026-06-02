/// <reference lib="webworker" />
// Custom service-worker code merged into the generated SW by
// @ducanh2912/next-pwa (see next.config.ts → customWorkerSrc).
//
// Adds Web Push handlers on top of Workbox's caching. Workbox owns
// install/activate/fetch; we only register push + notificationclick.

declare const self: ServiceWorkerGlobalScope;

type PushMessage = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
};

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: PushMessage;
  try {
    payload = event.data.json() as PushMessage;
  } catch {
    payload = { title: "Notification", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon ?? "/icons/icon-192.png",
      badge: payload.badge ?? "/icons/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target =
    (event.notification.data as { url?: string } | undefined)?.url ?? "/";

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // If the app is already open in any tab, focus and navigate it.
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await (client as WindowClient).navigate(target);
            } catch {
              // Some browsers throw if cross-origin; ignore.
            }
          }
          return;
        }
      }
      // Otherwise open a fresh window.
      await self.clients.openWindow(target);
    })()
  );
});

export {};
