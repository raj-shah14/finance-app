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

  const reset = () => {
    setError(null);
    setType("real_estate");
    setName("");
    setCurrentValue("");
    setPurchasePrice("");
    setPurchaseDate("");
    setNotes("");
  };

  const handleSave = async () => {
    setError(null);
    const currentValueNum = parseFloat(currentValue);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!Number.isFinite(currentValueNum) || currentValueNum < 0) {
      setError("Current value must be a non-negative number");
      return;
    }
    const purchasePriceNum = purchasePrice ? parseFloat(purchasePrice) : null;
    setBusy(true);
    try {
      const subtype =
        ASSET_TYPES.find((t) => t.value === type)?.defaultSubtype || null;
      const res = await fetch("/api/accounts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          subtype,
          currentValue: currentValueNum,
          purchasePrice: purchasePriceNum,
          purchaseDate: purchaseDate || null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create asset");
        return;
      }
      reset();
      setOpen(false);
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create asset");
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
          <DialogTitle>Add Manual Asset</DialogTitle>
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
              placeholder={activeType?.exampleName ?? "Asset name"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
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
              Save asset
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
