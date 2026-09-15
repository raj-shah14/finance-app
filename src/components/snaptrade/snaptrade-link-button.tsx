"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Briefcase, Loader2, RefreshCw } from "lucide-react";

/**
 * Opens SnapTrade's Connection Portal in a popup so the user can link
 * Robinhood, Coinbase, Fidelity, etc. After the popup closes, we POST
 * to `/api/snaptrade/sync` to pull the new accounts.
 *
 * Pass `reconnectAuthorizationId` (an existing SnapTradeItem's
 * authorizationId) when repairing an already-connected brokerage instead
 * of adding a new one — this tells SnapTrade to refresh that same
 * connection in place. Without it, re-linking an already-connected
 * brokerage creates a second authorization with its own new account IDs,
 * which sync then ingests as duplicate accounts rather than recognizing
 * them as the same ones.
 */
export function SnapTradeLinkButton({
  onSuccess,
  reconnectAuthorizationId,
  iconOnly,
}: {
  onSuccess?: () => void;
  reconnectAuthorizationId?: string;
  iconOnly?: boolean;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/snaptrade/login-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          reconnectAuthorizationId ? { authorizationId: reconnectAuthorizationId } : {}
        ),
      });
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

  if (iconOnly) {
    return (
      <Button
        onClick={handleClick}
        disabled={loading}
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary hover:bg-primary/10"
        aria-label="Reconnect"
        title="Reconnect"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline">
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : reconnectAuthorizationId ? (
        <RefreshCw className="mr-2 h-4 w-4" />
      ) : (
        <Briefcase className="mr-2 h-4 w-4" />
      )}
      {reconnectAuthorizationId ? "Reconnect" : "Connect Brokerage"}
    </Button>
  );
}
