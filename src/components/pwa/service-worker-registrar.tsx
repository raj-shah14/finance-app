"use client";

import { useEffect } from "react";

/**
 * Registers the service worker on mount (no-op on the server / when
 * SW isn't supported / when @ducanh2912/next-pwa is disabled in dev).
 *
 * `next-pwa` injects /sw.js at build time; we manually call
 * navigator.serviceWorker.register so the registration happens as soon
 * as the dashboard mounts rather than waiting for the workbox runtime.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Skip in dev — next-pwa is disabled in development so /sw.js
    // would 404; avoid the console noise.
    if (process.env.NODE_ENV === "development") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  }, []);

  return null;
}
