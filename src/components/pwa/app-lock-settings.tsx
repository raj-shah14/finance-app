"use client";

import { useEffect, useState } from "react";
import {
  Fingerprint,
  KeyRound,
  Loader2,
  Trash2,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";

type LockSettings = {
  enabled: boolean;
  idleMinutes: number;
  hasPin: boolean;
  credentialCount: number;
};

type Credential = {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

const IDLE_OPTIONS = [1, 5, 15, 30, 60, 240];

export function AppLockSettings() {
  const [settings, setSettings] = useState<LockSettings | null>(null);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [s, c] = await Promise.all([
        fetch("/api/applock/settings").then((r) => r.json()),
        fetch("/api/biometric/credentials").then((r) => r.json()),
      ]);
      setSettings(s);
      setCreds(c.credentials ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };
  useEffect(() => {
    refresh();
  }, []);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/applock/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const setIdle = async (mins: number) => {
    setBusy(true);
    try {
      await fetch("/api/applock/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idleMinutes: mins }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const enrollBiometric = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!("credentials" in navigator)) {
        throw new Error("This browser doesn't support biometric auth.");
      }
      const { startRegistration } = await import("@simplewebauthn/browser");
      const optsRes = await fetch("/api/biometric/register-options", {
        method: "POST",
      });
      if (!optsRes.ok) {
        const data = await optsRes.json();
        throw new Error(data.error || "Could not start enrollment");
      }
      const opts = await optsRes.json();
      const attestation = await startRegistration({ optionsJSON: opts });
      const deviceLabel =
        navigator.userAgent.match(/(iPhone|iPad|Android|Mac|Windows)/)?.[1] ??
        "Device";
      const verifyRes = await fetch("/api/biometric/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attestation, deviceLabel }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || "Enrollment failed");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteCredential = async (id: string) => {
    if (!confirm("Remove this device's Face ID enrollment?")) return;
    setBusy(true);
    try {
      await fetch("/api/biometric/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!settings) {
    return (
      <p className="text-sm text-muted-foreground">Loading App Lock settings…</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Master toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">App Lock</p>
          <p className="text-xs text-muted-foreground">
            Require Face ID or PIN to view the dashboard on cold open and after
            idle.
          </p>
        </div>
        <Button
          variant={settings.enabled ? "secondary" : "default"}
          size="sm"
          disabled={busy}
          onClick={() => toggle(!settings.enabled)}
        >
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          {settings.enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {/* Idle timeout */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Idle timeout</p>
          <p className="text-xs text-muted-foreground">
            Re-lock after this long with no activity.
          </p>
        </div>
        <Select
          value={String(settings.idleMinutes)}
          onValueChange={(v) => setIdle(parseInt(v, 10))}
          disabled={!settings.enabled}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IDLE_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m < 60 ? `${m} min` : `${m / 60} hr`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Face ID enrollment */}
      <div className="rounded-md border px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Fingerprint className="h-4 w-4" />
              Face ID / Touch ID
            </p>
            <p className="text-xs text-muted-foreground">
              {creds.length === 0
                ? "Enroll this device to unlock with biometrics."
                : `${creds.length} device${creds.length === 1 ? "" : "s"} enrolled.`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={enrollBiometric} disabled={busy}>
            {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
            {creds.length === 0 ? "Enroll" : "Add device"}
          </Button>
        </div>
        {creds.length > 0 && (
          <div className="space-y-1.5 pt-1.5 border-t border-border/40">
            {creds.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Smartphone className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">
                    {c.deviceLabel ?? "Device"}
                  </span>
                  <span className="text-muted-foreground truncate">
                    ·{" "}
                    {c.lastUsedAt
                      ? `used ${formatDistanceToNow(new Date(c.lastUsedAt), { addSuffix: true })}`
                      : `enrolled ${formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}`}
                  </span>
                </div>
                <button
                  onClick={() => deleteCredential(c.id)}
                  className="text-muted-foreground hover:text-rose-600 shrink-0"
                  aria-label="Remove device"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PIN */}
      <PinSettings hasPin={settings.hasPin} onChanged={refresh} />

      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}

function PinSettings({
  hasPin,
  onChanged,
}: {
  hasPin: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const reset = () => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setError(null);
  };

  const save = async () => {
    setError(null);
    if (!/^\d{4,10}$/.test(newPin)) {
      setError("PIN must be 4–10 digits");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs don't match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/applock/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin, currentPin: hasPin ? currentPin : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed");
        return;
      }
      reset();
      setOpen(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const removePin = async () => {
    if (!confirm("Remove your PIN? App Lock will require Face ID alone (if enrolled).")) return;
    setBusy(true);
    try {
      await fetch("/api/applock/pin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin }),
      });
      onChanged();
    } finally {
      setBusy(false);
      reset();
      setOpen(false);
    }
  };

  return (
    <div className="rounded-md border px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <KeyRound className="h-4 w-4" />
            PIN
          </p>
          <p className="text-xs text-muted-foreground">
            {hasPin
              ? "Set — used as fallback when Face ID is unavailable."
              : "Not set. 4–10 digit numeric fallback."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              {hasPin ? "Change" : "Set PIN"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{hasPin ? "Change PIN" : "Set PIN"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {hasPin && (
                <div>
                  <Label htmlFor="pin-current">Current PIN</Label>
                  <Input
                    id="pin-current"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={currentPin}
                    onChange={(e) =>
                      setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                  />
                </div>
              )}
              <div>
                <Label htmlFor="pin-new">New PIN (4–10 digits)</Label>
                <Input
                  id="pin-new"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                />
              </div>
              <div>
                <Label htmlFor="pin-confirm">Confirm new PIN</Label>
                <Input
                  id="pin-confirm"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                />
              </div>
              {error && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
              )}
              <div className="flex justify-between items-center pt-2">
                {hasPin ? (
                  <Button variant="ghost" size="sm" onClick={removePin} disabled={busy} className="text-rose-600">
                    Remove PIN
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
