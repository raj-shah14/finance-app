"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2 } from "lucide-react";

/**
 * Opens SnapTrade's Connection Portal in a popup so the user can link
 * Robinhood, Coinbase, Fidelity, etc. After the popup closes, we POST
 * to `/api/snaptrade/sync` to pull the new accounts.
 */
export function SnapTradeLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/snaptrade/login-link", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.redirectURI) {
        alert(data.error || "Failed to start SnapTrade flow");
        setLoading(false);
        return;
      }

      const popup = window.open(
        data.redirectURI,
        "snaptrade-link",
        "width=600,height=820,scrollbars=yes"
      );
      if (!popup) {
        alert("Popup blocked. Please allow popups and try again.");
        setLoading(false);
        return;
      }

      // Poll until the popup is closed, then wait briefly for SnapTrade
      // to finish ingesting the brokerage data on their side (account
      // import is async — usually 10–30s after the user clicks Done).
      const interval = setInterval(async () => {
        if (popup.closed) {
          clearInterval(interval);
          // Initial sync — may return 0 accounts if SnapTrade hasn't
          // finished importing yet. Retry once after a short delay.
          const runSync = async () => {
            const r = await fetch("/api/sync", { method: "POST" });
            return r.ok ? r.json() : Promise.reject(await r.json());
          };
          try {
            await runSync();
            // Wait 15s and retry to catch late-arriving accounts.
            await new Promise((res) => setTimeout(res, 15_000));
            await runSync();
          } catch (err) {
            console.error("SnapTrade sync after link failed:", err);
            alert(
              (err as { error?: string })?.error ||
                "Sync failed. Try the Refresh button shortly."
            );
          } finally {
            setLoading(false);
            onSuccess?.();
          }
        }
      }, 800);
    } catch (err) {
      console.error("SnapTrade link error:", err);
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      variant="outline"
      className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Briefcase className="mr-2 h-4 w-4" />
      )}
      Connect Brokerage
    </Button>
  );
}
