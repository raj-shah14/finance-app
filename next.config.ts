import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Auto-version the SW by build output so each deploy invalidates
  // the previous cache cleanly (see plan: deployment strategy).
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // skipWaiting + clientsClaim: new SW activates immediately on next
  // page load instead of waiting for all tabs to close. Critical so
  // an installed PWA picks up new versions on first launch after deploy.
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    // Cache strategies — keep read-only data fresh in background but
    // serve cached version instantly. NEVER cache mutations.
    runtimeCaching: [
      {
        // Read-only dashboard data — serve stale, refresh in background.
        urlPattern: ({ url }: { url: URL }) =>
          url.pathname.startsWith("/api/insights") ||
          url.pathname.startsWith("/api/accounts") ||
          url.pathname.startsWith("/api/transactions") ||
          url.pathname.startsWith("/api/goals") ||
          url.pathname.startsWith("/api/budgets") ||
          url.pathname.startsWith("/api/categories"),
        handler: "StaleWhileRevalidate",
        method: "GET",
        options: {
          cacheName: "api-readonly",
          expiration: { maxAgeSeconds: 24 * 60 * 60, maxEntries: 100 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // Static Next.js build assets — never change for a given hash.
        urlPattern: /\/_next\/static\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxAgeSeconds: 30 * 24 * 60 * 60, maxEntries: 200 },
        },
      },
      {
        // App-served images (logo, icons, account icons).
        urlPattern: /\.(?:png|jpg|jpeg|svg|webp|gif|ico)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "images",
          expiration: { maxAgeSeconds: 30 * 24 * 60 * 60, maxEntries: 100 },
        },
      },
      {
        // Fonts (Inter, Playfair).
        urlPattern: /\.(?:woff2?|ttf|otf)$/,
        handler: "CacheFirst",
        options: {
          cacheName: "fonts",
          expiration: { maxAgeSeconds: 365 * 24 * 60 * 60, maxEntries: 30 },
        },
      },
    ],
  },
  // Disable SW in dev so HMR isn't disrupted; only enable for builds.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // Service worker must always be served from the origin with the
        // narrowest scope possible — avoid Service-Worker-Allowed
        // headers and keep the file at /sw.js.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
