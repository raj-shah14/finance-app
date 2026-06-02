"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Toggle UI for the user's push-notification preference. Renders one of:
 *   - "Push not supported"          — browser lacks ServiceWorker / PushManager
 *   - "Notifications blocked"       — permission was denied (need browser settings)
 *   - "Enable notifications"        — not yet subscribed; clicking requests permission + subscribes
 *   - "Notifications on" + Disable  — subscribed; clicking unsubscribes
 *   - "Send test" button always shown when subscribed
 *
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY to be set; otherwise renders a
 * warning so the developer notices the missing config.
 */
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Allocate a fresh ArrayBuffer (not SharedArrayBuffer) so the type
  // matches BufferSource expected by PushManager.subscribe.
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}

type State =
  | "loading"
  | "unsupported"
  | "blocked"
  | "subscribed"
  | "unsubscribed"
  | "no-key";

export function NotificationsToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setState("no-key");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      setState(existing ? "subscribed" : "unsubscribed");
    } catch {
      setState("unsupported");
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "unsubscribed");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to register subscription");
      }
      setState("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable notifications");
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable");
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      if (data.sent === 0) {
        setError("No active subscriptions reachable. Try toggling off and on.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {state === "loading" && (
        <p className="text-sm text-muted-foreground">Checking notification settings…</p>
      )}
      {state === "unsupported" && (
        <p className="text-sm text-muted-foreground">
          Push notifications aren&apos;t supported in this browser. On iPhone, install
          the app to your home screen first (Share → Add to Home Screen), then
          re-open from there.
        </p>
      )}
      {state === "no-key" && (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          Server is missing <code>NEXT_PUBLIC_VAPID_PUBLIC_KEY</code>. Add VAPID
          keys to your env config to enable push notifications.
        </p>
      )}
      {state === "blocked" && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Notifications are blocked. Re-enable in your device&apos;s system
          notification settings for this site, then refresh.
        </p>
      )}
      {state === "unsubscribed" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Get push alerts for sync completion and budget thresholds.
          </p>
          <Button onClick={handleEnable} disabled={busy} className="gap-2 shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
            Enable
          </Button>
        </div>
      )}
      {state === "subscribed" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
            <Bell className="h-4 w-4" />
            Notifications are on for this device.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={busy}>
              Send test
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDisable} disabled={busy} className="gap-1.5">
              <BellOff className="h-4 w-4" />
              Disable
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
