"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyDetail,
  PALETTE,
  MONTH_NAMES,
  MONTH_NAMES_SHORT,
} from "@/lib/format";

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
  const [viewMode, setViewMode] = useState<"personal" | "household">("personal");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchAll = useCallback((mode: string, m: number, y: number) => {
    const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();
    Promise.all([
      fetch(`/api/insights?month=${m}&year=${y}&viewMode=${mode}`).then((r) => r.json()),
      fetch(`/api/transactions?viewMode=${mode}&startDate=${startDate}&endDate=${endDate}&limit=500`).then((r) => r.json()),
    ])
      .then(([ins, txData]) => {
        setInsights(ins.error ? null : ins);
        const txs: Transaction[] = txData.transactions || [];
        // Expenses: positive amounts (Plaid convention) and not in
        // transfer/income categories. Keep this in sync with
        // EXCLUDED_FROM_SPENDING in src/lib/categories.ts.
        const EXCLUDE = [
          "Salary",
          "Income",
          "CC Bill",
          "CC Payment",
          "CC Payments",
          "Transfer",
          "Transfers",
        ];
        setTxns(txs.filter((t) => t.amount > 0 && !EXCLUDE.includes(t.category?.name ?? "")));
      })
      .catch(() => { setInsights(null); setTxns([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(viewMode, month, year); }, [viewMode, month, year, fetchAll]);

  const fetchYearly = useCallback((mode: string, y: number) => {
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/insights?month=${i + 1}&year=${y}&viewMode=${mode}`)
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
  useEffect(() => { fetchYearly(viewMode, year); }, [viewMode, year, fetchYearly]);

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
            <p className="text-xs text-muted-foreground">{MONTH_NAMES[month - 1]} {year} · {viewMode === "household" ? "Household" : "Personal"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={goToPrev} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium w-20 text-center">{MONTH_NAMES_SHORT[month - 1]} {year}</span>
            <button onClick={goToNext} disabled={isCurrent} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "personal" | "household")}>
            <TabsList>
              <TabsTrigger value="personal">👤 Personal</TabsTrigger>
              <TabsTrigger value="household">🏠 Household</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40 border border-rose-100 dark:border-rose-900/40 px-3 py-2">
          <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Total Expenses</p>
          <p className="text-lg font-bold text-rose-600 dark:text-rose-300 tabular-nums">{formatCurrency(total)}</p>
          {change !== 0 && (
            <p className={`text-[11px] mt-0.5 flex items-center gap-0.5 font-medium ${change > 0 ? "text-rose-500" : "text-emerald-600"}`}>
              {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(change)}% vs last month
            </p>
          )}
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40 border border-purple-100 dark:border-purple-900/40 px-3 py-2">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Transactions</p>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-300 tabular-nums">{txns.length}</p>
          <p className="text-[11px] text-muted-foreground">This month</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-100 dark:border-orange-900/40 px-3 py-2">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Avg / Day</p>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-300 tabular-nums">{formatCurrency(total / daysInMonth)}</p>
          <p className="text-[11px] text-muted-foreground">Across {daysInMonth} days</p>
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
              <Tooltip
                formatter={(v) => formatCurrency(Number(v) || 0)}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="expenses"
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
                      <Pie data={allCategories.filter((c) => c.amount > 0)} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="amount" nameKey="categoryName">
                        {allCategories.filter((c) => c.amount > 0).map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
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
                <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} labelFormatter={(l) => `Day ${l}`} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                <Bar dataKey="amount" fill={PALETTE.purple} radius={[4, 4, 0, 0]} />
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
