"use client";

import { useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

export function PlaidLinkButton({ onSuccess }: { onSuccess?: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const createLinkToken = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const data = await res.json();
      setLinkToken(data.link_token);
      localStorage.setItem("plaid_link_token", data.link_token);
    } catch (error) {
      console.error("Failed to create link token:", error);
    }
    setLoading(false);
  };

  const onPlaidSuccess = useCallback(
    async (public_token: string, metadata: any) => {
      try {
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

        // Trigger initial transaction sync
        await fetch("/api/plaid/sync", { method: "POST" });

        setLinkToken(null);
        localStorage.removeItem("plaid_link_token");
        onSuccess?.();
      } catch (error) {
        console.error("Failed to exchange token:", error);
      }
    },
    [onSuccess]
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

  return (
    <Button
      onClick={handleClick}
      disabled={loading}
      className="bg-emerald-600 hover:bg-emerald-700"
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Plus className="mr-2 h-4 w-4" />
      )}
      Connect Account
    </Button>
  );
}
