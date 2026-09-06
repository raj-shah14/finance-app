"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, PiggyBank } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency, formatCurrencyDetail, CATEGORICAL_COLORS, PALETTE } from "@/lib/format";
import { InvestmentFan, DEMO_INVESTMENT_DATA } from "@/components/charts/investment-fan";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { HeroCard, ChipRow } from "@/components/dashboard/hero-card";

function changeText(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

interface HoldingsHistory {
  startOfYearValue: number;
  yearlyChangePercent: number;
  monthlyChangePercent: number;
  monthly: { month: string; value: number }[];
}

export function HoldingsView({
  title,
  description,
  accountFilter,
  accountTypeLabel,
  emptyLabel,
  kind,
  showAllocation = true,
}: {
  title: string;
  description: string;
  accountFilter: (a: Account) => boolean;
  accountTypeLabel: string;
  emptyLabel: string;
  kind: "savings" | "investments";
  /** Skip the Allocation fan chart + breakdown — e.g. Savings accounts all
   * share one asset type, so there's nothing to visually break down. */
  showAllocation?: boolean;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HoldingsHistory | null>(null);

  useEffect(() => {
    fetch(`/api/accounts`)
      .then((r) => r.json())
      .then((data) => setAccounts(data.accounts || []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`/api/holdings-history?kind=${kind}`)
      .then((r) => r.json())
      .then((d) => setHistory(d.error ? null : d))
      .catch(() => setHistory(null));
  }, [kind]);

  const holdings = accounts.filter(accountFilter);
  const realTotal = holdings.reduce((s, a) => s + (a.currentBalance ?? 0), 0);

  // Allocation by subtype
  const allocationMap = holdings.reduce<Record<string, number>>((acc, a) => {
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
              {title}
              {isDemo && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded">
                  demo data
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isDemo ? "No accounts linked yet — showing sample data" : description}
            </p>
          </div>
        </div>
      </div>

      {/* Hero: total value */}
      <HeroCard
        eyebrow={`Total ${title.toLowerCase()}`}
        value={formatCurrency(total)}
        subline={`${isDemo ? DEMO_INVESTMENT_DATA.length : holdings.length} accounts · ${allocation.length} asset types`}
      />

      {/* Top allocations — skipped when there's only one asset type, since
          a single 100%-share chip would just repeat the hero total above. */}
      {allocation.length > 1 && (
        <ChipRow
          title="Top allocations"
          chips={allocation.slice(0, 3).map((a) => ({
            key: a.name,
            label: capitalize(a.name.replace(/_/g, " ")),
            value: formatCurrency(a.amount),
          }))}
        />
      )}

      {/* Performance: month-over-month and year-to-date % change */}
      {!isDemo && history && (
        <ChipRow
          title="Performance"
          chips={[
            { key: "monthly", label: "This month", value: changeText(history.monthlyChangePercent) },
            { key: "yearly", label: `${new Date().getFullYear()} so far`, value: changeText(history.yearlyChangePercent) },
          ]}
        />
      )}

      {/* Trend: this calendar year only — resets to a fresh baseline every Jan 1 */}
      {!isDemo && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Trend · {new Date().getFullYear()}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {history && history.monthly.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={history.monthly} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltip valueFormatter={formatCurrency} />} />
                  <Line type="monotone" dataKey="value" name={title} stroke={PALETTE.emerald} strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: "#fff", stroke: PALETTE.emerald, strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-center px-6">
                <p className="text-sm text-muted-foreground">
                  Come back next month to start seeing your {title.toLowerCase()} trend — today&apos;s snapshot has been recorded.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className={showAllocation ? "grid gap-4 lg:grid-cols-12" : ""}>
        {showAllocation && (
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
                <p className="text-muted-foreground py-12 text-center text-sm">{emptyLabel}</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card className={showAllocation ? "lg:col-span-7 min-w-0" : "min-w-0"}>
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Accounts</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4 space-y-2.5">
            {holdings.length > 0 ? holdings.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] + "22", color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }}>
                  <PiggyBank className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.plaidItem?.institutionName ?? accountTypeLabel}
                    {a.subtype && ` · ${a.subtype.replace(/_/g, " ")}`}
                    {a.mask && ` · •••• ${a.mask}`}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums">{formatCurrencyDetail(a.currentBalance ?? 0)}</span>
              </div>
            )) : <p className="text-muted-foreground py-8 text-center text-sm">{emptyLabel}</p>}
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        Individual security holdings are not yet available — only account balances and their trend over time.
      </p>
    </div>
  );
}
