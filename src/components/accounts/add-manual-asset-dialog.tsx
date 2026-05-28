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
  const [merchantPatterns, setMerchantPatterns] = useState("");

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
    setMerchantPatterns("");
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
          merchantPatterns: patterns,
          purchaseDate: purchaseDate || null,
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
      <DialogContent className="max-w-md">
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
                  placeholder="450000"
                  value={originalPrincipal}
                  onChange={(e) => setOriginalPrincipal(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Starting principal when the loan was opened.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ma-rate">Interest rate (APR)</Label>
                  <Input
                    id="ma-rate"
                    type="number"
                    step="0.01"
                    placeholder="6.5"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ma-date">Loan start date</Label>
                  <Input
                    id="ma-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
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
                  Comma-separated. Any transaction matching one of these
                  will reduce the loan balance using amortization.
                </p>
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
