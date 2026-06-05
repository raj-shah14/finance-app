"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ArrowLeft, ChevronLeft, ChevronRight, CreditCard, Landmark } from "lucide-react";
import {
  formatCurrency,
  formatCurrencyDetail,
  PALETTE,
  CATEGORICAL_COLORS,
  MONTH_NAMES,
  MONTH_NAMES_SHORT,
} from "@/lib/format";

interface Account {
  id: string;
  name: string;
  officialName?: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  plaidItem?: { institutionName: string | null };
}

interface InsightsData {
  creditCardSpend?: number;
  prevCreditCardSpend?: number;
  loanSpend?: number;
  prevLoanSpend?: number;
}

export default function DebtsPage() {
  const now = new Date();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [yearlyCardSpend, setYearlyCardSpend] = useState<{ month: string; amount: number }[]>([]);
  const [yearlyLoanSpend, setYearlyLoanSpend] = useState<{ month: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const fetchAll = useCallback((m: number, y: number) => {
    Promise.all([
      fetch(`/api/accounts`).then((r) => r.json()),
      fetch(`/api/insights?month=${m}&year=${y}`).then((r) => r.json()),
    ])
      .then(([acctData, ins]) => {
        setAccounts(acctData.accounts || []);
        setInsights(ins.error ? null : ins);
      })
      .catch(() => { setAccounts([]); setInsights(null); })
      .finally(() => setLoading(false));
  }, []);

  const fetchYearly = useCallback((y: number) => {
    Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        fetch(`/api/insights?month=${i + 1}&year=${y}`).then((r) => r.json()).catch(() => null)
      )
    ).then((results) => {
      setYearlyCardSpend(results.map((d, i) => ({
        month: MONTH_NAMES_SHORT[i],
        amount: d?.creditCardSpend ?? 0,
      })));
      setYearlyLoanSpend(results.map((d, i) => ({
        month: MONTH_NAMES_SHORT[i],
        amount: d?.loanSpend ?? 0,
      })));
    });
  }, []);

  useEffect(() => { fetchAll(month, year); }, [month, year, fetchAll]);
  useEffect(() => { fetchYearly(year); }, [year, fetchYearly]);

  const creditCards = accounts.filter((a) => a.type === "credit");
  const loans = accounts.filter((a) => a.type === "loan");
  const totalCC = creditCards.reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const totalLoans = loans.reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const totalDebt = totalCC + totalLoans;

  const currMonthSpend = insights?.creditCardSpend ?? 0;
  const prevMonthSpend = insights?.prevCreditCardSpend ?? 0;
  const spendChange = prevMonthSpend > 0 ? ((currMonthSpend - prevMonthSpend) / prevMonthSpend) * 100 : 0;

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
            <h1 className="text-2xl font-bold tracking-tight">Debts</h1>
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

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 border border-red-100 dark:border-red-900/40 px-3 py-2">
          <p className="text-xs font-medium text-red-700 dark:text-red-400">Total Debt</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-300 tabular-nums">{formatCurrency(totalDebt)}</p>
          <p className="text-[11px] text-muted-foreground">All credit + loans</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-100 dark:border-orange-900/40 px-3 py-2">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Credit Cards</p>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-300 tabular-nums">{formatCurrency(totalCC)}</p>
          <p className="text-[11px] text-muted-foreground">{creditCards.length} {creditCards.length === 1 ? "card" : "cards"}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/40 dark:to-violet-950/40 border border-purple-100 dark:border-purple-900/40 px-3 py-2">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-400">Loans</p>
          <p className="text-lg font-bold text-purple-600 dark:text-purple-300 tabular-nums">{formatCurrency(totalLoans)}</p>
          <p className="text-[11px] text-muted-foreground">{loans.length} {loans.length === 1 ? "loan" : "loans"}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/40 dark:to-orange-950/40 border border-yellow-100 dark:border-yellow-900/40 px-3 py-2">
          <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Spent on Cards</p>
          <p className="text-lg font-bold text-yellow-600 dark:text-yellow-300 tabular-nums">{formatCurrency(currMonthSpend)}</p>
          {spendChange !== 0 && (
            <p className={`text-[11px] mt-0.5 font-medium ${spendChange > 0 ? "text-rose-500" : "text-emerald-600"}`}>
              {spendChange > 0 ? "↑" : "↓"} {Math.abs(spendChange).toFixed(0)}% vs last month
            </p>
          )}
        </div>
      </div>

      {/* Yearly spend trends — credit cards vs loan payments side by side */}
      <div className="grid gap-4 lg:grid-cols-2 min-w-0">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-6 flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Credit Card Spend · {year}</CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {formatCurrency(yearlyCardSpend.reduce((s, m) => s + m.amount, 0))}
            </span>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yearlyCardSpend}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {yearlyCardSpend.map((_, i) => (
                    <Cell key={i} fill={i === month - 1 ? PALETTE.red : PALETTE.red + "55"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-6 flex-row items-center justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">Loan Payments · {year}</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Mortgage, auto, and other loan payments by month
              </p>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {formatCurrency(yearlyLoanSpend.reduce((s, m) => s + m.amount, 0))}
            </span>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {yearlyLoanSpend.some((m) => m.amount > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={yearlyLoanSpend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/50" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v) || 0)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {yearlyLoanSpend.map((_, i) => (
                      <Cell key={i} fill={i === month - 1 ? PALETTE.purple : PALETTE.purple + "55"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-center px-6">
                <div>
                  <p className="text-sm text-muted-foreground">No loan payments tracked yet.</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Add a manual loan with merchant patterns (e.g. &ldquo;Freedom Mortgage&rdquo;,
                    &ldquo;Toyota Financial&rdquo;) on the Accounts page to see payments here.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accounts list */}
      <div className="grid gap-4 lg:grid-cols-2 min-w-0">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-6 flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Credit Cards</CardTitle>
            <span className="text-sm font-bold tabular-nums shrink-0">{formatCurrency(totalCC)}</span>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 space-y-2.5">
            {creditCards.length > 0 ? creditCards.map((a, i) => {
              const utilization = a.availableBalance && (a.currentBalance ?? 0) > 0
                ? ((a.currentBalance ?? 0) / ((a.currentBalance ?? 0) + a.availableBalance)) * 100
                : 0;
              return (
                <div key={a.id} className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] + "22", color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }}>
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {a.plaidItem?.institutionName ?? a.subtype ?? "Credit"}
                        {a.mask && ` · •••• ${a.mask}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums shrink-0">{formatCurrencyDetail(a.currentBalance ?? 0)}</span>
                  </div>
                  {a.availableBalance != null && (
                    <>
                      <Progress value={Math.min(utilization, 100)} className="h-1" />
                      <p className="text-[10px] text-muted-foreground text-right truncate">
                        {utilization.toFixed(0)}% used · {formatCurrency(a.availableBalance)} available
                      </p>
                    </>
                  )}
                </div>
              );
            }) : <p className="text-muted-foreground py-8 text-center text-sm">No credit cards linked</p>}
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-6 flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Loans</CardTitle>
            <span className="text-sm font-bold tabular-nums shrink-0">{formatCurrency(totalLoans)}</span>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 space-y-2.5">
            {loans.length > 0 ? loans.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 min-w-0">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] + "22", color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }}>
                  <Landmark className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {a.plaidItem?.institutionName ?? a.subtype ?? "Loan"}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums shrink-0">{formatCurrencyDetail(a.currentBalance ?? 0)}</span>
              </div>
            )) : <p className="text-muted-foreground py-8 text-center text-sm">No loans linked</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
