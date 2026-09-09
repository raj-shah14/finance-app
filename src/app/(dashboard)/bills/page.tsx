"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Trash2, Repeat } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { HeroCard } from "@/components/dashboard/hero-card";

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface Bill {
  id: string;
  name: string;
  amount: number;
  cadenceMonths: number;
  monthlyEquivalent: number;
  nextDueDate: string | null;
  notes: string | null;
  category: Category | null;
}

const CADENCE_LABELS: Record<number, string> = {
  1: "Monthly",
  3: "Quarterly",
  6: "Every 6 months",
  12: "Yearly",
};

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBills = useCallback(() => {
    fetch("/api/bills")
      .then((r) => r.json())
      .then((d) => setBills(d.bills || []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const handleCadenceChange = async (billId: string, cadenceMonths: string) => {
    setBills((prev) =>
      prev.map((b) =>
        b.id === billId
          ? { ...b, cadenceMonths: Number(cadenceMonths), monthlyEquivalent: b.amount / Number(cadenceMonths) }
          : b
      )
    );
    await fetch(`/api/bills/${billId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cadenceMonths: Number(cadenceMonths) }),
    });
  };

  const handleDelete = async (billId: string) => {
    if (!confirm("Stop tracking this bill?")) return;
    setBills((prev) => prev.filter((b) => b.id !== billId));
    await fetch(`/api/bills/${billId}`, { method: "DELETE" });
  };

  const totalMonthly = bills.reduce((s, b) => s + b.monthlyEquivalent, 0);

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bills & Subscriptions</h1>
          <p className="text-xs text-muted-foreground">Recurring bills tracked from your transactions</p>
        </div>
      </div>

      {/* Hero: total monthly cost across every cadence */}
      <HeroCard
        eyebrow="Monthly bill total"
        value={formatCurrency(totalMonthly)}
        subline={`${bills.length} bill${bills.length === 1 ? "" : "s"} tracked, converted to a monthly equivalent`}
      />

      {bills.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <Repeat className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">No bills tracked yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to <Link href="/transactions" className="text-primary underline">Transactions</Link> and mark a recurring charge (Netflix, rent, insurance, etc.) to start tracking it here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden divide-y">
          {bills.map((b) => (
            <div key={b.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base"
                style={{ backgroundColor: (b.category?.color ?? "#9ca3af") + "22", color: b.category?.color ?? "#9ca3af" }}
              >
                {b.category?.emoji ?? "📦"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate text-sm">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(b.amount)} {CADENCE_LABELS[b.cadenceMonths]?.toLowerCase() ?? `every ${b.cadenceMonths} mo`}
                  {b.nextDueDate && ` · Next ${new Date(b.nextDueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                </p>
              </div>
              <div className="text-right w-24 flex-shrink-0">
                <p className="font-semibold tabular-nums text-sm">{formatCurrency(b.monthlyEquivalent)}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">per month</p>
              </div>
              <Select value={String(b.cadenceMonths)} onValueChange={(v) => handleCadenceChange(b.id, v)}>
                <SelectTrigger className="h-8 w-[130px] text-xs flex-shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CADENCE_LABELS).map(([months, label]) => (
                    <SelectItem key={months} value={months}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => handleDelete(b.id)}
                aria-label="Stop tracking bill"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
