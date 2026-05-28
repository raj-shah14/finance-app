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

      // Poll until the popup is closed, then sync.
      const interval = setInterval(async () => {
        if (popup.closed) {
          clearInterval(interval);
          try {
            const syncRes = await fetch("/api/sync", { method: "POST" });
            const syncData = await syncRes.json();
            if (!syncRes.ok) {
              alert(syncData.error || "Failed to sync SnapTrade accounts");
            }
          } catch (err) {
            console.error("SnapTrade sync after link failed:", err);
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
