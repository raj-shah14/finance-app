"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2 } from "lucide-react";

/**
 * Quick-add dialog for recording a one-time extra principal payment on
 * a manual loan. Calls POST /api/accounts/manual/extra-payment.
 */
export function RecordExtraPaymentButton({
  accountId,
  loanName,
  onRecorded,
}: {
  accountId: string;
  loanName: string;
  onRecorded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const reset = () => {
    setError(null);
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setNotes("");
  };

  const handleSave = async () => {
    setError(null);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/accounts/manual/extra-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, amount: amt, date, notes: notes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to record payment");
        return;
      }
      reset();
      setOpen(false);
      onRecorded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] gap-1 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          <DollarSign className="h-3 w-3" />
          Extra payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record extra principal · {loanName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            100% of this amount applies to principal. Use for lump sums that
            don&apos;t match a merchant pattern (lender principal-only portal,
            wire, etc.).
          </p>
          <div>
            <Label htmlFor="ep-amount">Amount</Label>
            <Input
              id="ep-amount"
              type="number"
              step="0.01"
              placeholder="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ep-date">Payment date</Label>
            <Input
              id="ep-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ep-notes">Notes (optional)</Label>
            <Input
              id="ep-notes"
              placeholder="Year-end bonus payment"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Record payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
