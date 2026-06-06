"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  hasPinSet,
  isLocked as computeIsLocked,
  verifyPin,
  verifyBiometric,
  hasBiometricEnrolled,
  markActive,
  LOCK_TIMEOUT_MS,
} from "@/lib/app-lock";
import { Fingerprint, Delete, ShieldCheck } from "lucide-react";

/**
 * Wraps the dashboard. If the user has set a PIN and the inactivity
 * timeout has elapsed (or it's a fresh app open), shows a full-screen
 * lock overlay. Tracks user activity to extend the unlock window.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [mounted, setMounted] = useState(false);

  // On first mount: if a PIN exists, default to locked until verified.
  useEffect(() => {
    setMounted(true);
    if (hasPinSet()) setLocked(true);
  }, []);

  // Track activity (throttled to once per 10s) to update lastActive.
  useEffect(() => {
    if (!mounted || locked) return;
    let last = 0;
    const handler = () => {
      const now = Date.now();
      if (now - last < 10_000) return;
      last = now;
      markActive();
    };
    const events: (keyof DocumentEventMap)[] = [
      "click",
      "keydown",
      "touchstart",
      "scroll",
      "mousemove",
    ];
    events.forEach((e) => document.addEventListener(e, handler, { passive: true }));
    return () => events.forEach((e) => document.removeEventListener(e, handler));
  }, [mounted, locked]);

  // Re-lock when the tab returns to foreground after the timeout.
  useEffect(() => {
    if (!mounted) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && computeIsLocked()) {
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    // Also check periodically while open.
    const t = setInterval(() => {
      if (computeIsLocked()) setLocked(true);
    }, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, [mounted]);

  const onUnlock = useCallback(() => {
    markActive();
    setLocked(false);
  }, []);

  if (!mounted) return null;
  return (
    <>
      {children}
      {locked && <LockScreen onUnlock={onUnlock} />}
    </>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const triedBio = useRef(false);
  const bioEnrolled = hasBiometricEnrolled();

  const tryBiometric = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyBiometric();
      if (ok) onUnlock();
      else setError("Biometric unlock cancelled");
    } catch {
      setError("Biometric unlock failed");
    } finally {
      setBusy(false);
    }
  }, [busy, onUnlock]);

  // Auto-prompt Face ID once on mount if enrolled.
  useEffect(() => {
    if (bioEnrolled && !triedBio.current) {
      triedBio.current = true;
      tryBiometric();
    }
  }, [bioEnrolled, tryBiometric]);

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      const ok = await verifyPin(code);
      setBusy(false);
      if (ok) {
        onUnlock();
      } else {
        setError("Incorrect PIN");
        setPin("");
        // Haptic on supporting devices
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(60);
        }
      }
    },
    [onUnlock]
  );

  const handleKey = (digit: string) => {
    if (busy || pin.length >= 8) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 6) submit(next);
  };

  const handleBackspace = () => {
    if (busy) return;
    setPin((p) => p.slice(0, -1));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background px-6 py-12">
      <div className="flex flex-col items-center gap-3 mt-12">
        <div className="rounded-full bg-primary/10 p-4">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-lg font-semibold">FinancialFlow Locked</h1>
        <p className="text-xs text-muted-foreground">Enter your PIN to unlock</p>
      </div>

      <div className="flex flex-col items-center gap-6 flex-1 justify-center w-full max-w-xs">
        {/* PIN dots */}
        <div className="flex items-center gap-3 h-6">
          {Array.from({ length: Math.max(6, pin.length) }).map((_, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full border-2 ${
                i < pin.length
                  ? "bg-foreground border-foreground"
                  : "border-muted-foreground/40"
              }`}
            />
          ))}
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => handleKey(d)}
              disabled={busy}
              className="aspect-square rounded-full bg-muted hover:bg-muted/70 active:bg-muted/50 text-2xl font-light disabled:opacity-50 transition-colors"
            >
              {d}
            </button>
          ))}
          <button
            onClick={bioEnrolled ? tryBiometric : undefined}
            disabled={!bioEnrolled || busy}
            className="aspect-square rounded-full flex items-center justify-center hover:bg-muted/50 disabled:opacity-30 transition-colors"
            aria-label="Use biometric"
          >
            {bioEnrolled && <Fingerprint className="h-6 w-6" />}
          </button>
          <button
            onClick={() => handleKey("0")}
            disabled={busy}
            className="aspect-square rounded-full bg-muted hover:bg-muted/70 active:bg-muted/50 text-2xl font-light disabled:opacity-50 transition-colors"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            disabled={busy || pin.length === 0}
            className="aspect-square rounded-full flex items-center justify-center hover:bg-muted/50 disabled:opacity-30 transition-colors"
            aria-label="Delete"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
