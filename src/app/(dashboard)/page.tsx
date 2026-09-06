"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Coins,
  CreditCard,
  Landmark,
  LineChart,
  CalendarDays,
} from "lucide-react";
import { useUser } from "@/lib/hooks";
import { EXCLUDED_FROM_SPENDING } from "@/lib/categories";
import { formatCurrency, formatCurrencyDetail } from "@/lib/format";
import { HeroCard, TrendPill, ChipRow } from "@/components/dashboard/hero-card";
import { MonthPicker } from "@/components/dashboard/month-picker";

interface CategoryInsight {
  categoryId: string;
  categoryName: string;
  emoji: string;
  color: string;
  amount: number;
}

interface BudgetInsight {
  limit: number;
  spent: number;
}

interface InsightsData {
  totalSpending: number;
  totalIncome: number | null;
  totalChangePercent: number;
  allCategories: CategoryInsight[];
  budgetInsights: BudgetInsight[];
}

interface Account {
  type: string;
  subtype: string | null;
  currentBalance: number | null;
}

interface Transaction {
  id: string;
  name: string;
  merchantName?: string | null;
  amount: number;
  date: string;
  category?: { name: string; emoji: string; color: string } | null;
}

interface NetWorthSnapshot {
  netWorth: number;
}

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function DashboardPage() {
  const { user } = useUser();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState<NetWorthSnapshot | null>(null);
  const [weeklySpend, setWeeklySpend] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback((m: number, y: number) => {
    const startDate = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();

    Promise.all([
      fetch(`/api/insights?month=${m}&year=${y}`).then((r) => r.json()),
      fetch(`/api/transactions?limit=6&viewMode=personal&startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
      fetch(`/api/accounts`).then((r) => r.json()),
      fetch(`/api/net-worth`).then((r) => r.json()),
    ])
      .then(([insightsData, txData, acctData, netWorthData]) => {
        setInsights(insightsData.error ? null : insightsData);
        setTransactions(txData.transactions || []);
        setAccounts(acctData.accounts || []);
        setNetWorth(netWorthData.current ?? null);
      })
      .catch(() => {
        setInsights(null);
        setTransactions([]);
        setAccounts([]);
        setNetWorth(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData(month, year);
  }, [month, year, fetchData]);

  // Weekly spend — the last 7 calendar days ending today, independent of
  // the month tab above (a rolling week can straddle two months). Fetched
  // once on mount rather than re-fetched on month navigation.
  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    const startDate = new Date(Date.UTC(weekAgo.getFullYear(), weekAgo.getMonth(), weekAgo.getDate())).toISOString();
    const endDate = today.toISOString();

    fetch(`/api/transactions?viewMode=personal&startDate=${startDate}&endDate=${endDate}&limit=500`)
      .then((r) => r.json())
      .then((d) => {
        const txs: Transaction[] = d.transactions || [];
        const spend = txs
          .filter((t) => t.amount > 0 && !EXCLUDED_FROM_SPENDING.includes(t.category?.name ?? ""))
          .reduce((s, t) => s + t.amount, 0);
        setWeeklySpend(spend);
      })
      .catch(() => setWeeklySpend(0));
  }, []);

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const goToNextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const totalSpending = insights?.totalSpending ?? 0;
  const totalIncome = insights?.totalIncome ?? 0;
  const totalBudgetLimit = (insights?.budgetInsights ?? []).reduce((s, b) => s + b.limit, 0);
  const changePct = insights?.totalChangePercent ?? 0;
  const allCategories = insights?.allCategories ?? [];

  const totalChecking = accounts
    .filter((a) => a.type === "depository" && a.subtype === "checking")
    .reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const totalSavings = accounts
    .filter((a) => a.type === "depository" && a.subtype === "savings")
    .reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const totalInvestments = accounts
    .filter((a) => a.type === "investment")
    .reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const totalDebts = accounts
    .filter((a) => a.type === "credit" || a.type === "loan")
    .reduce((s, a) => s + (a.currentBalance ?? 0), 0);

  const quickLinks = [
    // Row 1: this week's activity
    { href: "/transactions?range=thisWeek", label: "This week", value: formatCurrency(weeklySpend), icon: CalendarDays },
    { href: "/debts", label: "Debts", value: formatCurrency(totalDebts), icon: CreditCard },
    { href: "/income", label: "Income", value: formatCurrency(totalIncome), icon: TrendingUp },
    { href: "/expenses", label: "Expenses", value: formatCurrency(totalSpending), icon: TrendingDown },
    // Row 2: balances
    { href: "/net-worth", label: "Net Worth", value: formatCurrency(netWorth?.netWorth ?? 0), icon: LineChart },
    { href: "/accounts", label: "Checking", value: formatCurrency(totalChecking), icon: Landmark },
    { href: "/savings", label: "Savings", value: formatCurrency(totalSavings), icon: PiggyBank },
    { href: "/investments", label: "Investments", value: formatCurrency(totalInvestments), icon: Coins },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}
            {user?.firstName ? `, ${user.firstName}` : ""}.
          </h1>
        </div>
        <MonthPicker month={month} year={year} onPrev={goToPrevMonth} onNext={goToNextMonth} nextDisabled={isCurrentMonth} />
      </div>

      {/* Hero: this month's spending */}
      <HeroCard
        eyebrow={`${MONTH_NAMES_SHORT[month - 1]} spending`}
        value={formatCurrency(totalSpending)}
        subline={totalBudgetLimit > 0 ? `of ${formatCurrency(totalBudgetLimit)} plan` : `${formatCurrency(totalIncome)} income`}
        pill={<TrendPill changePercent={changePct} />}
      />

      {/* Where it went */}
      <ChipRow
        title="Where it went"
        scrollable
        chips={allCategories.map((c) => ({
          key: c.categoryId,
          label: `${c.emoji} ${c.categoryName}`,
          value: formatCurrency(c.amount),
        }))}
      />

      {/* Quick links — one number each, full detail lives on each page */}
      <div>
        <p className="mb-2 text-sm font-semibold text-muted-foreground">Overview</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickLinks.map((q) => (
            <Link key={q.label} href={q.href} className="group block">
              <div className="rounded-2xl border bg-card p-4 transition group-hover:border-primary/60 group-hover:bg-primary/10">
                <q.icon className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2 text-base font-bold tabular-nums">{q.value}</p>
                <p className="text-xs text-muted-foreground">{q.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground">Just happened</p>
          <Link href="/transactions" className="text-xs font-medium text-primary hover:underline">
            See all
          </Link>
        </div>
        <div className="rounded-2xl border bg-card divide-y overflow-hidden">
          {transactions.length > 0 ? (
            transactions.slice(0, 6).map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-base shrink-0"
                  style={{
                    backgroundColor: (tx.category?.color ?? "#9ca3af") + "22",
                    color: tx.category?.color ?? "#9ca3af",
                  }}
                >
                  {tx.category?.emoji ?? "📝"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.merchantName ?? tx.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tx.category?.name ?? "Uncategorized"} · {format(new Date(tx.date), "MMM d")}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums shrink-0 ${tx.amount < 0 ? "text-emerald-600" : "text-foreground"}`}>
                  {tx.amount < 0 ? "+" : "-"}
                  {formatCurrencyDetail(tx.amount)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">No recent transactions</p>
          )}
        </div>
      </div>
    </div>
  );
}
