"use client";

import { useEffect, useCallback, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function PlaidOAuthPage() {
  const router = useRouter();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("plaid_link_token");
    if (storedToken) {
      setLinkToken(storedToken);
    }
  }, []);

  const onSuccess = useCallback(
    async (public_token: string) => {
      try {
        await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, metadata: {} }),
        });
        await fetch("/api/plaid/sync", { method: "POST" });
      } catch (error) {
        console.error("Failed to exchange token:", error);
      } finally {
        localStorage.removeItem("plaid_link_token");
        router.push("/accounts");
      }
    },
    [router]
  );

  const onExit = useCallback(() => {
    localStorage.removeItem("plaid_link_token");
    router.push("/accounts");
  }, [router]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    receivedRedirectUri: typeof window !== "undefined" ? window.location.href : undefined,
    onSuccess,
    onExit,
  });

  useEffect(() => {
    if (ready && linkToken) {
      open();
    }
  }, [ready, linkToken, open]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground">Completing bank connection...</p>
    </div>
  );
}
