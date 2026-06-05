"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { format } from "date-fns";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyDetail,
  PALETTE,
  CATEGORICAL_COLORS,
  MONTH_NAMES,
  MONTH_NAMES_SHORT,
} from "@/lib/format";

interface InsightsData {
  totalIncome: number | null;
  totalSpending: number;
  netSavings: number | null;
}

interface Transaction {
  id: string;
  name: string;
  merchantName?: string | null;
  amount: number;
  date: string;
  category?: { name: string; emoji: string; color: string } | null;
}

export default function IncomePage() {
  const now = new Date();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [incomeTxns, setIncomeTxns] = useState<Transaction[]>([]);
  const [yearly, setYearly] = useState<{ month: string; income: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchAll = useCallback((m: number, y: number) => {
    const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();
    Promise.all([
      fetch(`/api/insights?month=${m}&year=${y}`).then((r) => r.json()),
      // Income transactions = negative amount, in income categories (heuristic via category name)
      fetch(`/api/transactions?viewMode=personal&startDate=${startDate}&endDate=${endDate}&limit=200`).then((r) => r.json()),
    ])
      .then(([ins, txData]) => {
        setInsights(ins.error ? null : ins);
        const txs: Transaction[] = txData.transactions || [];
        // Income txns: negative amount AND category is Salary/Income (or no category but negative)
        const filtered = txs.filter((t) => t.amount < 0 && (t.category?.name === "Salary" || t.category?.name === "Income"));
        setIncomeTxns(filtered);
      })
      .catch(() => { setInsights(null); setIncomeTxns([]); })
      .finally(() => setLoading(false));
  }, []);

  const fetchYearly = useCallback((y: number) => {
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/insights?month=${i + 1}&year=${y}`).then((r) => r.json()).catch(() => null)
      )
    ).then((results) => {
      setYearly(results.map((d, i) => ({
        month: MONTH_NAMES_SHORT[i],
        income: d?.totalIncome ?? 0,
      })));
    });
  }, []);

  useEffect(() => { fetchAll(month, year); }, [month, year, fetchAll]);
  useEffect(() => { fetchYearly(year); }, [year, fetchYearly]);

  // Per-source breakdown (group by category name)
  const sources = Object.entries(
    incomeTxns.reduce<Record<string, { amount: number; color: string; count: number }>>((acc, t) => {
      const name = t.category?.name || "Other";
      const color = t.category?.color || PALETTE.gray;
      if (!acc[name]) acc[name] = { amount: 0, color, count: 0 };
      acc[name].amount += Math.abs(t.amount);
      acc[name].count += 1;
      return acc;
    }, {})
  )
    .map(([name, v], i) => ({
      name,
      amount: v.amount,
      count: v.count,
      color: v.color || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalIncome = insights?.totalIncome ?? 0;
  // MoM change
  const currentIdx = month - 1;
  const prevIncome = currentIdx > 0 ? (yearly[currentIdx - 1]?.income ?? 0) : 0;
  const momChange = prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0;

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
          <Link href="/" className="rounded-lg p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Income</h1>
            <p className="text-xs text-muted-foreground">
              {MONTH_NAMES[month - 1]} {year}
            </p>
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

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-100 dark:border-orange-900/40 px-3 py-2">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Total Income</p>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-300 tabular-nums">{formatCurrency(totalIncome)}</p>
          {momChange !== 0 && (
            <p className={`text-[11px] mt-0.5 flex items-center gap-0.5 font-medium ${momChange > 0 ? "text-emerald-600" : "text-rose-500"}`}>
              {momChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(momChange).toFixed(0)}% vs {MONTH_NAMES_SHORT[(month - 2 + 12) % 12]}
            </p>
          )}
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40 border border-purple-100 dark:border-purple-900/40 px-3 py-2">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Net Savings</p>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-300 tabular-nums">
            {insights?.netSavings != null ? formatCurrency(Math.max(0, insights.netSavings)) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Income − Expenses</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Savings Rate</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300 tabular-nums">
            {totalIncome > 0 ? `${Math.round(((insights?.netSavings ?? 0) / totalIncome) * 100)}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">Of total income</p>
        </div>
      </div>

      {/* Yearly trend */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-sm font-semibold">Income · {year}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={yearly} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
              <Line type="monotone" dataKey="income" stroke={PALETTE.orange} strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 5, fill: "#fff", stroke: PALETTE.orange, strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sources breakdown + transactions */}
      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5 min-w-0">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Income Sources</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            {sources.length > 0 ? (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={sources} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="amount" nameKey="name">
                        {sources.map((s, i) => <Cell key={i} fill={s.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Sources</p>
                    <p className="text-xl font-bold">{sources.length}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {sources.map((s) => {
                    const pct = totalIncome > 0 ? (s.amount / totalIncome) * 100 : 0;
                    return (
                      <div key={s.name} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="truncate">{s.name}</span>
                          <span className="text-muted-foreground">· {s.count}</span>
                        </div>
                        <span className="tabular-nums font-medium">{formatCurrency(s.amount)} · {pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">No income recorded this month</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-7 min-w-0">
          <CardHeader className="pb-2 pt-4 px-6">
            <CardTitle className="text-sm font-semibold">Income Transactions</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            {incomeTxns.length > 0 ? (
              <div className="divide-y">
                {incomeTxns.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg text-sm shrink-0" style={{ backgroundColor: (tx.category?.color ?? PALETTE.gray) + "22", color: tx.category?.color ?? PALETTE.gray }}>
                      {tx.category?.emoji ?? "💰"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.merchantName ?? tx.name}</p>
                      <p className="text-[11px] text-muted-foreground">{format(new Date(tx.date), "MMM d")} · {tx.category?.name ?? "Other"}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-emerald-600">+{formatCurrencyDetail(tx.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-12 text-center text-sm">No income transactions this month</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bar comparison - monthly income */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-6">
          <CardTitle className="text-sm font-semibold">Monthly Comparison · {year}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={yearly}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
              <Bar dataKey="income" radius={[6, 6, 0, 0]}>
                {yearly.map((d, i) => (
                  <Cell key={i} fill={i === currentIdx ? PALETTE.orange : PALETTE.orange + "55"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
