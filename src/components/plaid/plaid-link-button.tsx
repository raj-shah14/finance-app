"use client";

import { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw } from "lucide-react";

export function PlaidLinkButton({
  onSuccess,
  updateItemId,
  iconOnly,
}: {
  onSuccess?: () => void;
  updateItemId?: string;
  /** Icon only, no label — for tight rows (e.g. a per-institution list on
   * mobile) where the full-width button pushes past the row's edge. */
  iconOnly?: boolean;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const createLinkToken = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateItemId ? { plaidItemId: updateItemId } : {}),
      });
      const data = await res.json();
      if (!res.ok || !data.link_token) {
        throw new Error(data.error || "Failed to create a Plaid Link session");
      }
      setLinkToken(data.link_token);
      localStorage.setItem("plaid_link_token", data.link_token);
    } catch (error) {
      console.error("Failed to create link token:", error);
      alert(error instanceof Error ? error.message : "Failed to open Plaid Link");
    }
    setLoading(false);
  };

  const onPlaidSuccess = useCallback(
    async (public_token: string, metadata: any) => {
      try {
        if (updateItemId) {
          // Update-mode Link repairs the existing Item. Its access token does
          // not change, so exchanging the returned public token would be wrong.
          const syncRes = await fetch("/api/sync", { method: "POST" });
          const syncData = await syncRes.json().catch(() => ({}));
          if (!syncRes.ok || syncData.success === false) {
            throw new Error(syncData.error || "Account was reconnected, but sync failed");
          }
          setLinkToken(null);
          localStorage.removeItem("plaid_link_token");
          onSuccess?.();
          return;
        }

        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, metadata }),
        });

        if (res.status === 409) {
          alert("This institution is already connected.");
          setLinkToken(null);
          localStorage.removeItem("plaid_link_token");
          return;
        }

        // Trigger initial sync across all providers
        await fetch("/api/sync", { method: "POST" });

        setLinkToken(null);
        localStorage.removeItem("plaid_link_token");
        onSuccess?.();
      } catch (error) {
        console.error("Failed to exchange token:", error);
      }
    },
    [onSuccess, updateItemId]
  );

  const [hasOpened, setHasOpened] = useState(false);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  const handleClick = async () => {
    if (linkToken && ready) {
      open();
    } else {
      setHasOpened(false);
      await createLinkToken();
    }
  };

  // Auto-open once when link token becomes ready
  if (linkToken && ready && !hasOpened) {
    setHasOpened(true);
    open();
  }

  const label = updateItemId ? "Reconnect" : "Connect Account";

  if (iconOnly) {
    return (
      <Button
        onClick={handleClick}
        disabled={loading}
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-primary hover:bg-primary/10"
        aria-label={label}
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
    <Button onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        updateItemId ? <RefreshCw className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
