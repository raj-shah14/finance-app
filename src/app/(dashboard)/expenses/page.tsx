"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EXCLUDED_FROM_SPENDING } from "@/lib/categories";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format } from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyDetail,
  PALETTE,
  MONTH_NAMES,
  MONTH_NAMES_SHORT,
} from "@/lib/format";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { HeroCard, TrendPill, ChipRow } from "@/components/dashboard/hero-card";

interface CategoryInsight {
  categoryId: string;
  categoryName: string;
  emoji: string;
  color: string;
  amount: number;
  previousAmount: number;
  changePercent: number;
  transactionCount: number;
}

interface InsightsData {
  totalSpending: number;
  totalChangePercent: number;
  allCategories: CategoryInsight[];
  dailySpending?: { date: string; amount: number }[];
  budgetInsights?: { limit: number }[];
}

interface Transaction {
  id: string;
  name: string;
  merchantName?: string | null;
  amount: number;
  date: string;
  category?: { name: string; emoji: string; color: string } | null;
}

export default function ExpensesPage() {
  const now = new Date();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [yearly, setYearly] = useState<{ month: string; expenses: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchAll = useCallback((m: number, y: number) => {
    const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();
    Promise.all([
      fetch(`/api/insights?month=${m}&year=${y}`).then((r) => r.json()),
      fetch(`/api/transactions?viewMode=personal&startDate=${startDate}&endDate=${endDate}&limit=500`).then((r) => r.json()),
    ])
      .then(([ins, txData]) => {
        setInsights(ins.error ? null : ins);
        const txs: Transaction[] = txData.transactions || [];
        // Expenses: positive amounts (Plaid convention) and not in
        // transfer/income categories.
        setTxns(txs.filter((t) => t.amount > 0 && !EXCLUDED_FROM_SPENDING.includes(t.category?.name ?? "")));
      })
      .catch(() => { setInsights(null); setTxns([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(month, year); }, [month, year, fetchAll]);

  const fetchYearly = useCallback((y: number) => {
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/insights?month=${i + 1}&year=${y}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    ).then((results) => {
      setYearly(
        results.map((d, i) => ({
          month: MONTH_NAMES_SHORT[i],
          expenses: d?.totalSpending ?? 0,
        }))
      );
    });
  }, []);
  useEffect(() => { fetchYearly(year); }, [year, fetchYearly]);

  // Top merchants
  const merchants = Object.entries(
    txns.reduce<Record<string, { amount: number; count: number; emoji: string; color: string }>>((acc, t) => {
      const name = t.merchantName || t.name;
      if (!acc[name]) acc[name] = { amount: 0, count: 0, emoji: t.category?.emoji ?? "📝", color: t.category?.color ?? PALETTE.gray };
      acc[name].amount += t.amount;
      acc[name].count += 1;
      return acc;
    }, {})
  )
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  // Daily spending — build from txns to ensure correctness regardless of API field
  const dailyMap = txns.reduce<Record<string, number>>((acc, t) => {
    const day = format(new Date(t.date), "d");
    acc[day] = (acc[day] || 0) + t.amount;
    return acc;
  }, {});
  const daysInMonth = new Date(year, month, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({
    day: String(i + 1),
    amount: dailyMap[String(i + 1)] || 0,
  }));

  const allCategories = insights?.allCategories ?? [];
  const total = insights?.totalSpending ?? 0;
  const totalBudgetLimit = (insights?.budgetInsights ?? []).reduce((s, b) => s + b.limit, 0);
  const topCategories = allCategories.filter((c) => c.amount > 0).slice(0, 3);

  // Donut data — fold slivers under 3% of the total into one "Other" wedge
  // so the ring reads as a handful of clean shapes instead of a dozen
  // unreadable slices. The itemized list below still shows every category.
  const positiveCategories = allCategories.filter((c) => c.amount > 0);
  const pieTotal = positiveCategories.reduce((s, c) => s + c.amount, 0);
  const pieMain = positiveCategories.filter((c) => pieTotal > 0 && c.amount / pieTotal >= 0.03);
  const pieOtherAmount = positiveCategories
    .filter((c) => !(pieTotal > 0 && c.amount / pieTotal >= 0.03))
    .reduce((s, c) => s + c.amount, 0);
  const pieData = pieOtherAmount > 0
    ? [...pieMain, { categoryId: "other", categoryName: "Other", amount: pieOtherAmount, color: PALETTE.gray }]
    : pieMain;
  // Prefer MoM derived from the yearly trend so the % stays consistent
  // with the chart's neighbouring bars. Fall back to insights' value
  // before the trend has loaded.
  const currentIdx = month - 1;
  const trendCurr = yearly[currentIdx]?.expenses ?? total;
  const trendPrev = currentIdx > 0 ? (yearly[currentIdx - 1]?.expenses ?? 0) : 0;
  const change =
    trendPrev > 0
      ? Math.round(((trendCurr - trendPrev) / trendPrev) * 100)
      : insights?.totalChangePercent ?? 0;
  const yearTotal = yearly.reduce((s, m) => s + m.expenses, 0);

  const goToPrev = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();
  const goToNext = () => {
    if (isCurrent) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
            <p className="text-xs text-muted-foreground">{MONTH_NAMES[month - 1]} {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={goToPrev} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium w-20 text-center">{MONTH_NAMES_SHORT[month - 1]} {year}</span>
            <button onClick={goToNext} disabled={isCurrent} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Hero: this month's spending */}
      <HeroCard
        eyebrow={`${MONTH_NAMES_SHORT[month - 1]} spending`}
        value={formatCurrency(total)}
        subline={totalBudgetLimit > 0 ? `of ${formatCurrency(totalBudgetLimit)} plan` : `${txns.length} transactions`}
        pill={<TrendPill changePercent={change} />}
      />

      {/* Where it went */}
      <ChipRow
        title="Where it went"
        chips={topCategories.map((c) => ({
          key: c.categoryId,
          label: `${c.emoji} ${c.categoryName}`,
          value: formatCurrency(c.amount),
        }))}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-base font-bold tabular-nums">{txns.length}</p>
          <p className="text-xs text-muted-foreground">Transactions</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-base font-bold tabular-nums">{formatCurrency(total / daysInMonth)}</p>
          <p className="text-xs text-muted-foreground">Avg / day</p>
        </div>
      </div>

      {/* Yearly trend */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-6 flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Expenses · {year}</CardTitle>
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {formatCurrency(yearTotal)}
          </span>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={yearly} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltip valueFormatter={formatCurrency} />} />
              <Line
                type="monotone"
                dataKey="expenses"
                name="Expenses"
                stroke={PALETTE.red}
                strokeWidth={3}
                dot={{ r: 0 }}
                activeDot={{ r: 5, fill: "#fff", stroke: PALETTE.red, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category breakdown + daily chart */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5 min-w-0">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">By Category</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            {allCategories.length > 0 ? (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={3}
                        cornerRadius={6}
                        stroke="var(--background)"
                        strokeWidth={2}
                        dataKey="amount"
                        nameKey="categoryName"
                      >
                        {pieData.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                      <Tooltip
                        content={
                          <ChartTooltip
                            valueFormatter={formatCurrency}
                            dotColor={(entry) => (entry.payload as { color?: string } | undefined)?.color ?? PALETTE.gray}
                          />
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{formatCurrency(total)}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                  {allCategories.map((c) => {
                    const pct = total > 0 ? (Math.abs(c.amount) / total) * 100 : 0;
                    const isRefund = c.amount < 0;
                    return (
                      <div key={c.categoryId} className="space-y-1">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-2 min-w-0 flex-1 truncate">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            {c.emoji} {c.categoryName}
                          </span>
                          <span className={`tabular-nums font-medium shrink-0 ${isRefund ? "text-emerald-600" : ""}`}>
                            {isRefund ? "+" : ""}{formatCurrency(Math.abs(c.amount))} · {pct.toFixed(0)}%
                          </span>
                        </div>
                        {!isRefund && <Progress value={Math.min(pct, 100)} className="h-1" />}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">No expenses recorded</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7 min-w-0">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Daily Spending</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  content={<ChartTooltip valueFormatter={formatCurrency} labelFormatter={(l) => `Day ${l}`} />}
                />
                <Bar dataKey="amount" name="Spent" fill={PALETTE.purple} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top merchants */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-sm font-semibold">Top Merchants</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {merchants.length > 0 ? (
            <div className="divide-y">
              {merchants.map((m, i) => (
                <div key={m.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">{i + 1}</span>
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg text-sm shrink-0" style={{ backgroundColor: m.color + "22", color: m.color }}>
                    {m.emoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-[11px] text-muted-foreground">{m.count} {m.count === 1 ? "transaction" : "transactions"}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{formatCurrencyDetail(m.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">No merchant data</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
