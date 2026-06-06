"use client";

import { useState, useEffect } from "react";
import {
  hasPinSet,
  setPin as savePin,
  clearLock,
  biometricSupported,
  hasBiometricEnrolled,
  enrollBiometric,
  clearBiometric,
} from "@/lib/app-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Fingerprint, ShieldCheck, ShieldOff } from "lucide-react";

export function AppLockSettings({ userLabel }: { userLabel: string }) {
  const [hasPin, setHasPin] = useState(false);
  const [hasBio, setHasBio] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHasPin(hasPinSet());
    setHasBio(hasBiometricEnrolled());
    setBioOk(biometricSupported());
  }, []);

  const refresh = () => {
    setHasPin(hasPinSet());
    setHasBio(hasBiometricEnrolled());
  };

  const handleSetPin = async () => {
    setError(null);
    if (!/^\d{4,8}$/.test(pin)) {
      setError("PIN must be 4–8 digits");
      return;
    }
    if (pin !== confirm) {
      setError("PINs do not match");
      return;
    }
    setBusy(true);
    try {
      await savePin(pin);
      setPin("");
      setConfirm("");
      setSetupOpen(false);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save PIN");
    } finally {
      setBusy(false);
    }
  };

  const handleEnableBio = async () => {
    setError(null);
    setBusy(true);
    try {
      await enrollBiometric(userLabel);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDisableBio = () => {
    clearBiometric();
    refresh();
  };

  const handleDisableLock = () => {
    if (window.confirm("Remove app lock? Anyone with access to this device will be able to open the app.")) {
      clearLock();
      refresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 ${hasPin ? "bg-emerald-100 dark:bg-emerald-950/40" : "bg-muted"}`}>
          {hasPin ? (
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">
            App Lock {hasPin ? "Enabled" : "Disabled"}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasPin
              ? "App locks after 5 minutes of inactivity. PIN required to unlock."
              : "Set a PIN to require unlock when opening the app on this device."}
          </p>
        </div>
      </div>

      {/* PIN setup */}
      {!hasPin && !setupOpen && (
        <Button onClick={() => setSetupOpen(true)} variant="outline" className="gap-2">
          <Lock className="h-4 w-4" /> Set up PIN
        </Button>
      )}

      {!hasPin && setupOpen && (
        <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/30">
          <div>
            <Label htmlFor="pin-new" className="text-xs">New PIN (4–8 digits)</Label>
            <Input
              id="pin-new"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
            />
          </div>
          <div>
            <Label htmlFor="pin-confirm" className="text-xs">Confirm PIN</Label>
            <Input
              id="pin-confirm"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
            />
          </div>
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleSetPin} disabled={busy} size="sm">
              Save PIN
            </Button>
            <Button
              onClick={() => { setSetupOpen(false); setPin(""); setConfirm(""); setError(null); }}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Biometric — only when PIN exists */}
      {hasPin && bioOk && (
        <div className="flex items-start gap-3 rounded-lg border border-border p-3">
          <div className="rounded-full p-2 bg-muted">
            <Fingerprint className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Face ID / Touch ID</p>
            <p className="text-xs text-muted-foreground">
              {hasBio
                ? "Quick unlock with biometrics is enabled on this device."
                : "Use Face ID, Touch ID, or your device's biometric to unlock quickly."}
            </p>
          </div>
          {hasBio ? (
            <Button onClick={handleDisableBio} variant="ghost" size="sm">
              Disable
            </Button>
          ) : (
            <Button onClick={handleEnableBio} disabled={busy} size="sm">
              Enable
            </Button>
          )}
        </div>
      )}

      {/* Disable lock entirely */}
      {hasPin && (
        <Button onClick={handleDisableLock} variant="ghost" size="sm" className="text-rose-500 hover:text-rose-600">
          Remove App Lock
        </Button>
      )}

      {error && hasPin && <p className="text-xs text-rose-500">{error}</p>}

      <p className="text-[11px] text-muted-foreground">
        The lock is per-device and stored locally in your browser. It protects this app's UI on this device only — it does not change your account password.
      </p>
    </div>
  );
}
