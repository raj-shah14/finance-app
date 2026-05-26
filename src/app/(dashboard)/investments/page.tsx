"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, PiggyBank } from "lucide-react";
import { formatCurrency, formatCurrencyDetail, PALETTE, CATEGORICAL_COLORS } from "@/lib/format";
import { InvestmentFan, DEMO_INVESTMENT_DATA } from "@/components/charts/investment-fan";

interface Account {
  id: string;
  name: string;
  officialName?: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  plaidItem?: { institutionName: string | null };
}

export default function InvestmentsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/accounts`)
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  const investments = accounts.filter((a) => a.type === "investment");
  const realTotal = investments.reduce((s, a) => s + (a.currentBalance ?? 0), 0);

  // Allocation by subtype
  const allocationMap = investments.reduce<Record<string, number>>((acc, a) => {
    const key = a.subtype || "Other";
    acc[key] = (acc[key] || 0) + (a.currentBalance ?? 0);
    return acc;
  }, {});
  const realAllocation = Object.entries(allocationMap)
    .map(([name, amount], i) => ({
      name,
      amount,
      color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);

  // Fall back to demo data when no real accounts are linked yet.
  const isDemo = realAllocation.length === 0;
  const allocation = isDemo
    ? DEMO_INVESTMENT_DATA.map((d) => ({ name: d.name, amount: d.value, color: d.color }))
    : realAllocation;
  const total = isDemo
    ? DEMO_INVESTMENT_DATA.reduce((s, d) => s + d.value, 0)
    : realTotal;

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              Investments
              {isDemo && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
                  demo data
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isDemo ? "No accounts linked yet — showing sample data" : "Current portfolio across all linked accounts"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40 border border-purple-100 dark:border-purple-900/40 px-3 py-2">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Total Portfolio</p>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-300 tabular-nums">{formatCurrency(total)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Accounts</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300 tabular-nums">{isDemo ? DEMO_INVESTMENT_DATA.length : investments.length}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-100 dark:border-orange-900/40 px-3 py-2">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Asset Types</p>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-300 tabular-nums">{allocation.length}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5 min-w-0">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Allocation</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            {allocation.length > 0 ? (
              <>
                <div className="relative">
                  <InvestmentFan
                    data={allocation.map((a) => ({
                      name: a.name,
                      value: a.amount,
                      color: a.color,
                    }))}
                    height={340}
                    innerRadius={72}
                    outerRadius={210}
                    maxStripes={5}
                    showLegend={false}
                  />
                  <div className="absolute left-0 right-0 bottom-12 flex flex-col items-center pointer-events-none">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{formatCurrency(total)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5">
                  {allocation.map((a) => {
                    const pct = total > 0 ? (a.amount / total) * 100 : 0;
                    return (
                      <div key={a.name} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                          <span className="truncate capitalize">{a.name.replace(/_/g, " ")}</span>
                        </div>
                        <span className="tabular-nums font-medium">{formatCurrency(a.amount)} · {pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">No investment accounts</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7 min-w-0">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Accounts</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4 space-y-2.5">
            {investments.length > 0 ? investments.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] + "22", color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }}>
                  <PiggyBank className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.plaidItem?.institutionName ?? "Investment"}
                    {a.subtype && ` · ${a.subtype.replace(/_/g, " ")}`}
                    {a.mask && ` · •••• ${a.mask}`}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums">{formatCurrencyDetail(a.currentBalance ?? 0)}</span>
              </div>
            )) : <p className="text-muted-foreground py-8 text-center text-sm">No investment accounts linked</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Holdings detail (individual securities, performance over time) is not yet available — only account balances.
      </p>
      <p className="hidden">{PALETTE.gray}</p>
    </div>
  );
}
