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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home, Loader2 } from "lucide-react";

/**
 * Dialog for adding a manual asset (real estate, vehicle, etc.) — these
 * flow into Net Worth on /accounts but are not synced. The user updates
 * the current value manually.
 */
const ASSET_TYPES: Array<{
  value: string;
  label: string;
  exampleName: string;
  defaultSubtype: string;
}> = [
  {
    value: "real_estate",
    label: "Real Estate",
    exampleName: "Primary Residence",
    defaultSubtype: "primary residence",
  },
  {
    value: "vehicle",
    label: "Vehicle",
    exampleName: "2023 Toyota",
    defaultSubtype: "auto",
  },
  {
    value: "other_asset",
    label: "Other Asset",
    exampleName: "Collectibles",
    defaultSubtype: "",
  },
  {
    value: "loan",
    label: "Loan",
    exampleName: "Freedom Mortgage",
    defaultSubtype: "mortgage",
  },
];

export function AddManualAssetDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState("real_estate");
  const [name, setName] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [notes, setNotes] = useState("");
  // Loan-only state
  const [originalPrincipal, setOriginalPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [termMonths, setTermMonths] = useState("360");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [escrowMonthly, setEscrowMonthly] = useState("");
  const [hoaMonthly, setHoaMonthly] = useState("");
  const [extraPrincipalMonthly, setExtraPrincipalMonthly] = useState("");
  const [merchantPatterns, setMerchantPatterns] = useState("");
  const [currentBalanceOverride, setCurrentBalanceOverride] = useState("");
  const [currentBalanceAsOf, setCurrentBalanceAsOf] = useState("");

  const isLoan = type === "loan";

  const reset = () => {
    setError(null);
    setType("real_estate");
    setName("");
    setCurrentValue("");
    setPurchasePrice("");
    setPurchaseDate("");
    setNotes("");
    setOriginalPrincipal("");
    setInterestRate("");
    setTermMonths("360");
    setMonthlyPayment("");
    setEscrowMonthly("");
    setHoaMonthly("");
    setExtraPrincipalMonthly("");
    setMerchantPatterns("");
    setCurrentBalanceOverride("");
    setCurrentBalanceAsOf("");
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setBusy(true);
    try {
      const subtype =
        ASSET_TYPES.find((t) => t.value === type)?.defaultSubtype || null;

      let body: Record<string, unknown>;
      if (isLoan) {
        const principalNum = parseFloat(originalPrincipal);
        if (!Number.isFinite(principalNum) || principalNum <= 0) {
          setError("Original loan amount must be a positive number");
          setBusy(false);
          return;
        }
        const rateNum = interestRate ? parseFloat(interestRate) : null;
        if (rateNum !== null && (!Number.isFinite(rateNum) || rateNum < 0)) {
          setError("Interest rate must be a non-negative number");
          setBusy(false);
          return;
        }
        const termNum = parseInt(termMonths, 10);
        if (!Number.isFinite(termNum) || termNum <= 0) {
          setError("Loan term (months) must be a positive integer");
          setBusy(false);
          return;
        }
        const patterns = merchantPatterns
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        body = {
          name: name.trim(),
          type: "loan",
          subtype,
          originalPrincipal: principalNum,
          interestRate: rateNum,
          termMonths: termNum,
          monthlyPayment: monthlyPayment ? parseFloat(monthlyPayment) : null,
          escrowMonthly: escrowMonthly ? parseFloat(escrowMonthly) : null,
          hoaMonthly: hoaMonthly ? parseFloat(hoaMonthly) : null,
          extraPrincipalMonthly: extraPrincipalMonthly
            ? parseFloat(extraPrincipalMonthly)
            : null,
          merchantPatterns: patterns,
          purchaseDate: purchaseDate || null,
          currentBalanceOverride: currentBalanceOverride
            ? parseFloat(currentBalanceOverride)
            : null,
          currentBalanceAsOf: currentBalanceAsOf || null,
          notes: notes.trim() || null,
        };
      } else {
        const currentValueNum = parseFloat(currentValue);
        if (!Number.isFinite(currentValueNum) || currentValueNum < 0) {
          setError("Current value must be a non-negative number");
          setBusy(false);
          return;
        }
        const purchasePriceNum = purchasePrice ? parseFloat(purchasePrice) : null;
        body = {
          name: name.trim(),
          type,
          subtype,
          currentValue: currentValueNum,
          purchasePrice: purchasePriceNum,
          purchaseDate: purchaseDate || null,
          notes: notes.trim() || null,
        };
      }

      const res = await fetch("/api/accounts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create");
        return;
      }
      reset();
      setOpen(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  };

  const activeType = ASSET_TYPES.find((t) => t.value === type);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Home className="h-4 w-4" />
          Add Manual Asset
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isLoan ? "Add Manual Loan" : "Add Manual Asset"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="ma-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="ma-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ma-name">Name</Label>
            <Input
              id="ma-name"
              placeholder={activeType?.exampleName ?? "Name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {isLoan ? (
            <>
              <div>
                <Label htmlFor="ma-principal">Original loan amount</Label>
                <Input
                  id="ma-principal"
                  type="number"
                  placeholder="567000"
                  value={originalPrincipal}
                  onChange={(e) => setOriginalPrincipal(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Starting principal when the loan was opened.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ma-rate">Interest rate (APR %)</Label>
                  <Input
                    id="ma-rate"
                    type="number"
                    step="0.001"
                    placeholder="6.375"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Note rate (ignore buydowns).
                  </p>
                </div>
                <div>
                  <Label htmlFor="ma-term">Term (months)</Label>
                  <Input
                    id="ma-term"
                    type="number"
                    placeholder="360"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    60 = 5yr · 360 = 30yr
                  </p>
                </div>
              </div>
              <div>
                <Label htmlFor="ma-date">Loan start date</Label>
                <Input
                  id="ma-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Anchors the amortization schedule.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ma-escrow">Escrow / mo</Label>
                  <Input
                    id="ma-escrow"
                    type="number"
                    step="0.01"
                    placeholder="Taxes + insurance"
                    value={escrowMonthly}
                    onChange={(e) => setEscrowMonthly(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ma-hoa">HOA / mo</Label>
                  <Input
                    id="ma-hoa"
                    type="number"
                    step="0.01"
                    placeholder="Optional"
                    value={hoaMonthly}
                    onChange={(e) => setHoaMonthly(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ma-pmt">Monthly P&amp;I</Label>
                  <Input
                    id="ma-pmt"
                    type="number"
                    step="0.01"
                    placeholder="Auto if blank"
                    value={monthlyPayment}
                    onChange={(e) => setMonthlyPayment(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Override scheduled P&amp;I.
                  </p>
                </div>
                <div>
                  <Label htmlFor="ma-extra">Extra principal / mo</Label>
                  <Input
                    id="ma-extra"
                    type="number"
                    step="0.01"
                    placeholder="Optional"
                    value={extraPrincipalMonthly}
                    onChange={(e) => setExtraPrincipalMonthly(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="ma-patterns">Merchant patterns</Label>
                <Input
                  id="ma-patterns"
                  placeholder="Freedom Mortgage, Toyota Financial"
                  value={merchantPatterns}
                  onChange={(e) => setMerchantPatterns(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Comma-separated. Any payment matching these is checked
                  for extra principal (excess over scheduled P&amp;I +
                  escrow + HOA).
                </p>
              </div>
              <div className="rounded-md border border-dashed border-border/60 p-2.5 space-y-2.5 bg-muted/30">
                <p className="text-[11px] font-medium text-muted-foreground">
                  Optional: anchor to today&apos;s actual balance (overrides
                  start-date math, recommended if you have a recent statement)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ma-cb">Current balance</Label>
                    <Input
                      id="ma-cb"
                      type="number"
                      step="0.01"
                      placeholder="13571.33"
                      value={currentBalanceOverride}
                      onChange={(e) => setCurrentBalanceOverride(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ma-cb-asof">As of date</Label>
                    <Input
                      id="ma-cb-asof"
                      type="date"
                      value={currentBalanceAsOf}
                      onChange={(e) => setCurrentBalanceAsOf(e.target.value)}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Defaults to today
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="ma-current">Current value</Label>
                <Input
                  id="ma-current"
                  type="number"
                  placeholder="500000"
                  value={currentValue}
                  onChange={(e) => setCurrentValue(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Your best estimate today (Zillow, KBB, etc.). Update anytime.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ma-purchase">Purchase price</Label>
                  <Input
                    id="ma-purchase"
                    type="number"
                    placeholder="Optional"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ma-date">Purchase date</Label>
                  <Input
                    id="ma-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="ma-notes">Notes</Label>
            <Input
              id="ma-notes"
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isLoan ? "Save loan" : "Save asset"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
