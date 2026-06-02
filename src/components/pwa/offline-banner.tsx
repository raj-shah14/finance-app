"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Banner shown when the browser reports it is offline. Designed for
 * mobile-first PWAs: anchored to the top under the system status bar,
 * non-blocking, dismisses automatically when connectivity returns.
 *
 * The cached dashboard data is still served by the service worker
 * (StaleWhileRevalidate on /api/insights, /api/accounts, etc.), so the
 * user sees their last-known state with this banner indicating it may
 * be stale.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-white text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-1.5 shadow-md safe-pt"
    >
      <WifiOff className="h-3.5 w-3.5" />
      <span>Offline — viewing cached data. Changes will sync when reconnected.</span>
    </div>
  );
}
