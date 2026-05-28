"use client";

import { useEffect } from "react";

/**
 * Tiny callback page that SnapTrade redirects the popup to when the user
 * clicks "Done" in the Connection Portal. We just close the window —
 * the parent window is polling `window.closed` and will trigger the sync
 * as soon as it sees the popup gone.
 */
export default function SnapTradeCallbackPage() {
  useEffect(() => {
    try {
      window.close();
    } catch {
      // Ignore — older browsers may not allow programmatic close.
    }
  }, []);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-center">
      <div>
        <p className="text-lg font-semibold">All set!</p>
        <p className="text-sm text-muted-foreground mt-1">
          You can close this window.
        </p>
      </div>
    </div>
  );
}
