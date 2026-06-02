"use client";

import { useEffect, useState, useCallback } from "react";
import { useClerk } from "@clerk/nextjs";
import { Fingerprint, Lock, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const IDLE_KEY = "applock_last_active";
const SESSION_UNLOCK_KEY = "applock_unlocked_session";

type LockSettings = {
  enabled: boolean;
  idleMinutes: number;
  hasPin: boolean;
  credentialCount: number;
};

/**
 * Full-screen lock overlay rendered above the dashboard. Decides
 * whether to lock on mount based on:
 *   - server-reported applock_enabled
 *   - sessionStorage "unlocked" flag (cleared on cold open)
 *   - last-active timestamp in localStorage vs idle minutes
 *
 * Flow when locked:
 *   1. If biometric credentials exist, immediately prompt Face ID
 *   2. PIN keypad always available as fallback
 *   3. "Sign out" link at bottom calls Clerk signOut() → /sign-in
 *      (escape hatch for forgotten PIN / wrong user)
 *   4. After 5 wrong PIN attempts the server returns 423 and auto-
 *      signs the user out
 */
export function AppLock({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const [settings, setSettings] = useState<LockSettings | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinDigits, setPinDigits] = useState("");

  // 1. Fetch settings once; decide initial lock state.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/applock/settings");
        if (!res.ok) return;
        const data: LockSettings = await res.json();
        if (!mounted) return;
        setSettings(data);
        if (!data.enabled) {
          setLocked(false);
          return;
        }
        // Lock if no session-unlock flag (cold open) OR idle too long.
        const unlockedThisSession =
          sessionStorage.getItem(SESSION_UNLOCK_KEY) === "1";
        const lastActive = parseInt(
          localStorage.getItem(IDLE_KEY) ?? "0",
          10
        );
        const idleMs = data.idleMinutes * 60_000;
        const overIdle = lastActive > 0 && Date.now() - lastActive > idleMs;
        if (!unlockedThisSession || overIdle) {
          setLocked(true);
        }
      } catch {
        // Settings fetch failed (likely unauth) — don't lock the UI.
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Idle tracking: refresh lastActive on user activity.
  useEffect(() => {
    if (!settings?.enabled) return;
    const bump = () => {
      localStorage.setItem(IDLE_KEY, String(Date.now()));
    };
    bump();
    const events: (keyof WindowEventMap)[] = [
      "click",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [settings?.enabled]);

  // 3. Lock when the tab is hidden long enough to exceed idle.
  useEffect(() => {
    if (!settings?.enabled) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt > 0) {
        const idleMs = settings.idleMinutes * 60_000;
        if (Date.now() - hiddenAt > idleMs) {
          sessionStorage.removeItem(SESSION_UNLOCK_KEY);
          setLocked(true);
        }
        hiddenAt = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [settings?.enabled, settings?.idleMinutes]);

  const onUnlocked = useCallback(() => {
    sessionStorage.setItem(SESSION_UNLOCK_KEY, "1");
    localStorage.setItem(IDLE_KEY, String(Date.now()));
    setLocked(false);
    setPinDigits("");
    setError(null);
  }, []);

  const handleBiometric = useCallback(async () => {
    if (busy || !settings?.credentialCount) return;
    setBusy(true);
    setError(null);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const optsRes = await fetch("/api/biometric/assert-options", {
        method: "POST",
      });
      if (!optsRes.ok) throw new Error("Could not start Face ID");
      const opts = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: opts });
      const verifyRes = await fetch("/api/biometric/assert-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || "Face ID failed");
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face ID failed");
    } finally {
      setBusy(false);
    }
  }, [busy, settings?.credentialCount, onUnlocked]);

  // 4. Auto-prompt Face ID when the overlay opens (best practice on iOS).
  useEffect(() => {
    if (locked && settings?.credentialCount) {
      handleBiometric();
    }
  }, [locked, settings?.credentialCount, handleBiometric]);

  const handlePin = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/applock/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinDigits }),
      });
      const data = await res.json();
      if (res.status === 423) {
        // Locked out — auto sign-out per plan.
        await clerk.signOut({ redirectUrl: "/sign-in" });
        return;
      }
      if (!res.ok) {
        setError(data.error || "Incorrect PIN");
        setPinDigits("");
        return;
      }
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await clerk.signOut({ redirectUrl: "/sign-in" });
  };

  // Render the dashboard underneath; overlay sits on top when locked.
  return (
    <>
      {children}
      {locked && (
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-center px-6 safe-pt safe-pb">
          <div className="max-w-sm w-full space-y-6 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold">App Lock</h1>
              <p className="text-sm text-muted-foreground">
                Verify your identity to view your finances
              </p>
            </div>

            {settings?.credentialCount ? (
              <Button
                onClick={handleBiometric}
                disabled={busy}
                className="w-full gap-2"
                size="lg"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Fingerprint className="h-4 w-4" />
                )}
                Unlock with Face ID
              </Button>
            ) : null}

            {settings?.hasPin && (
              <div className="space-y-2">
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus={!settings.credentialCount}
                  value={pinDigits}
                  onChange={(e) =>
                    setPinDigits(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pinDigits.length >= 4) handlePin();
                  }}
                  placeholder="Enter PIN"
                  className="w-full text-center text-2xl tracking-[0.4em] tabular-nums py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <Button
                  onClick={handlePin}
                  disabled={busy || pinDigits.length < 4}
                  variant="outline"
                  className="w-full"
                >
                  Unlock with PIN
                </Button>
              </div>
            )}

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            )}

            <button
              onClick={handleSignOut}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
