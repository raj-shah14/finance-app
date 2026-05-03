"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  startOfYear,
  isSameDay,
} from "date-fns";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  Clock,
} from "lucide-react";

// Plaid stores transaction dates as calendar dates (UTC midnight). Parsing
// them with `new Date(iso)` and formatting in local time shifts the displayed
// day by one in any timezone west of UTC. Treat the YYYY-MM-DD portion as a
// local date so display matches the Plaid calendar date and the date filter.
function parseTxDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

type DatePresetKey =
  | "thisMonth"
  | "lastMonth"
  | "last30"
  | "last90"
  | "thisYear"
  | "custom";

const DATE_PRESETS: { key: DatePresetKey; label: string; range: () => { start: string; end: string } | null }[] = [
  {
    key: "thisMonth",
    label: "This month",
    range: () => ({ start: ymd(startOfMonth(new Date())), end: ymd(endOfMonth(new Date())) }),
  },
  {
    key: "lastMonth",
    label: "Last month",
    range: () => {
      const ref = subMonths(new Date(), 1);
      return { start: ymd(startOfMonth(ref)), end: ymd(endOfMonth(ref)) };
    },
  },
  {
    key: "last30",
    label: "Last 30 days",
    range: () => ({ start: ymd(subDays(new Date(), 29)), end: ymd(new Date()) }),
  },
  {
    key: "last90",
    label: "Last 90 days",
    range: () => ({ start: ymd(subDays(new Date(), 89)), end: ymd(new Date()) }),
  },
  {
    key: "thisYear",
    label: "This year",
    range: () => ({ start: ymd(startOfYear(new Date())), end: ymd(new Date()) }),
  },
  { key: "custom", label: "Custom range", range: () => null },
];

function detectPreset(start: string, end: string): DatePresetKey {
  for (const p of DATE_PRESETS) {
    const r = p.range();
    if (r && r.start === start && r.end === end) return p.key;
  }
  return "custom";
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

interface Transaction {
  id: string;
  amount: number;
  date: string;
  name: string;
  merchantName: string | null;
  pending: boolean;
  categoryId: string | null;
  category: Category | null;
  account: { name: string; mask: string; type: string };
  user: { firstName: string; lastName: string };
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

const formatCurrency = (amount: number) =>
  `$${Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function dayHeaderLabel(date: Date): string {
  const today = new Date();
  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, subDays(today, 1))) return "Yesterday";
  return format(date, "EEEE, MMM d, yyyy");
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(() => ymd(startOfMonth(new Date())));
  const [endDate, setEndDate] = useState(() => ymd(endOfMonth(new Date())));
  const [categoryId, setCategoryId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"personal" | "household">("personal");
  const [categories, setCategories] = useState<Category[]>([]);
  const [persons, setPersons] = useState<{ id: string; name: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const activePreset = detectPreset(startDate, endDate);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => { if (data.categories) setCategories(data.categories); })
      .catch(() => {});
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("viewMode", viewMode);
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (categoryId) params.set("categoryId", categoryId);
      if (userId) params.set("userId", userId);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: TransactionsResponse = await res.json();

      setTransactions(data.transactions);
      setTotalPages(data.totalPages);
      setTotal(data.total);

      const personMap = new Map<string, string>();
      data.transactions.forEach((t) => {
        const key = `${t.user.firstName} ${t.user.lastName}`;
        if (!personMap.has(key)) personMap.set(key, key);
      });
      setPersons((prev) => {
        const merged = new Map<string, string>();
        prev.forEach((p) => merged.set(p.id, p.name));
        personMap.forEach((name, id) => merged.set(id, name));
        return Array.from(merged.entries()).map(([id, name]) => ({ id, name }));
      });
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, startDate, endDate, categoryId, userId, viewMode]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { setPage(1); }, [search, startDate, endDate, categoryId, userId, viewMode]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      await fetchTransactions();
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleCategoryChange = async (transactionId: string, newCategoryId: string) => {
    try {
      const res = await fetch("/api/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transactionId, categoryId: newCategoryId }),
      });
      if (!res.ok) throw new Error("Failed to update category");
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? { ...t, categoryId: newCategoryId, category: categories.find((c) => c.id === newCategoryId) ?? t.category }
            : t
        )
      );
    } catch (err) {
      console.error("Error updating category:", err);
    } finally {
      setEditingCategoryId(null);
    }
  };

  const applyPreset = (key: DatePresetKey) => {
    if (key === "custom") {
      setShowAdvanced(true);
      return;
    }
    const preset = DATE_PRESETS.find((p) => p.key === key);
    const r = preset?.range();
    if (r) {
      setStartDate(r.start);
      setEndDate(r.end);
    }
  };

  // Filtered totals (visible page only — this matches what the user sees)
  const pageTotals = useMemo(() => {
    let spent = 0;
    let received = 0;
    transactions.forEach((t) => {
      if (t.amount > 0) spent += t.amount;
      else received += -t.amount;
    });
    return { spent, received, net: received - spent };
  }, [transactions]);

  // Group by date for display
  const grouped = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    transactions.forEach((t) => {
      const key = t.date.slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    });
    return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [transactions]);

  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (search) activeFilters.push({ key: "search", label: `“${search}”`, clear: () => setSearch("") });
  if (categoryId) {
    const c = categories.find((x) => x.id === categoryId);
    if (c) activeFilters.push({ key: "cat", label: `${c.emoji} ${c.name}`, clear: () => setCategoryId("") });
  }
  if (userId) {
    const p = persons.find((x) => x.id === userId);
    if (p) activeFilters.push({ key: "user", label: p.name, clear: () => setUserId("") });
  }

  const clearAll = () => {
    setSearch("");
    setCategoryId("");
    setUserId("");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {total.toLocaleString()} {total === 1 ? "transaction" : "transactions"}
            {" · "}
            {viewMode === "household" ? "Household view" : "Your transactions"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "personal" | "household")}>
            <TabsList>
              <TabsTrigger value="personal" className="gap-1.5">👤 Personal</TabsTrigger>
              <TabsTrigger value="household" className="gap-1.5">🏠 Household</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleSync} disabled={syncing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync"}
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-rose-50/40 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/40 px-4 py-3">
          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400 uppercase tracking-wide">Spent (this page)</p>
          <p className="text-xl font-bold text-rose-600 dark:text-rose-300 mt-0.5 tabular-nums">{formatCurrency(pageTotals.spent)}</p>
        </div>
        <div className="rounded-xl border bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 px-4 py-3">
          <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Received (this page)</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-300 mt-0.5 tabular-nums">{formatCurrency(pageTotals.received)}</p>
        </div>
        <div className="rounded-xl border bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/40 px-4 py-3">
          <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">Net (this page)</p>
          <p className={`text-xl font-bold mt-0.5 tabular-nums ${pageTotals.net >= 0 ? "text-indigo-600 dark:text-indigo-300" : "text-rose-600 dark:text-rose-400"}`}>
            {pageTotals.net < 0 ? "-" : ""}{formatCurrency(pageTotals.net)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">
          {/* Top row: search + date preset + filter toggle */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search merchant or description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={activePreset} onValueChange={(v) => applyPreset(v as DatePresetKey)}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setShowAdvanced((s) => !s)}
              className="sm:w-auto"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {(categoryId || userId) && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  {[categoryId, userId].filter(Boolean).length}
                </span>
              )}
            </Button>
          </div>

          {/* Advanced filters */}
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">From</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">To</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Category</label>
                <Select value={categoryId || "all"} onValueChange={(val) => setCategoryId(val === "all" ? "" : val)}>
                  <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Member</label>
                <Select value={userId || "all"} onValueChange={(val) => setUserId(val === "all" ? "" : val)}>
                  <SelectTrigger><SelectValue placeholder="All Members" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {persons.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="group inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors"
                >
                  {f.label}
                  <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                </button>
              ))}
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground ml-1"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transactions list */}
      <Card>
        <CardContent className="pt-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-muted-foreground font-medium">No transactions found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or sync your accounts.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([dateKey, txs]) => {
                const date = parseTxDate(dateKey);
                const dayNet = txs.reduce((s, t) => s + t.amount, 0);
                return (
                  <div key={dateKey}>
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-1 z-10">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {dayHeaderLabel(date)}
                      </p>
                      <p className={`text-xs font-semibold tabular-nums ${dayNet > 0 ? "text-rose-500" : dayNet < 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {dayNet > 0 ? "-" : dayNet < 0 ? "+" : ""}{formatCurrency(dayNet)}
                      </p>
                    </div>

                    {/* Day's transactions */}
                    <div className="rounded-xl border divide-y overflow-hidden">
                      {txs.map((t) => {
                        const isExpense = t.amount > 0;
                        const tile = t.category?.color ?? "#9ca3af";
                        return (
                          <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                            {/* Category tile */}
                            <div
                              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-base"
                              style={{ backgroundColor: tile + "22", color: tile }}
                            >
                              {t.category?.emoji ?? "📝"}
                            </div>

                            {/* Merchant + meta */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium truncate text-sm">{t.merchantName ?? t.name}</p>
                                {t.pending && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md shrink-0">
                                    <Clock className="h-2.5 w-2.5" /> Pending
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.account.name}
                                {t.account.mask ? ` ••${t.account.mask}` : ""}
                                {viewMode === "household" && t.user && (
                                  <span> · {t.user.firstName}</span>
                                )}
                              </p>
                              {/* Mobile: inline category pill below meta */}
                              <div className="sm:hidden mt-1.5">
                                {editingCategoryId === t.id ? (
                                  <Select
                                    value={t.categoryId ?? ""}
                                    onValueChange={(val) => handleCategoryChange(t.id, val)}
                                    onOpenChange={(open) => { if (!open) setEditingCategoryId(null); }}
                                    defaultOpen
                                  >
                                    <SelectTrigger className="h-7 text-xs w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Badge
                                    variant="secondary"
                                    className="cursor-pointer hover:bg-muted-foreground/20 transition-colors max-w-full truncate"
                                    onClick={() => setEditingCategoryId(t.id)}
                                  >
                                    {t.category ? `${t.category.emoji} ${t.category.name}` : "Uncategorized"}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Desktop: category pill / inline editor */}
                            <div className="hidden sm:block flex-shrink-0 w-[170px]">
                              {editingCategoryId === t.id ? (
                                <Select
                                  value={t.categoryId ?? ""}
                                  onValueChange={(val) => handleCategoryChange(t.id, val)}
                                  onOpenChange={(open) => { if (!open) setEditingCategoryId(null); }}
                                  defaultOpen
                                >
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((cat) => (
                                      <SelectItem key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-muted-foreground/20 transition-colors w-full justify-start truncate"
                                  onClick={() => setEditingCategoryId(t.id)}
                                >
                                  {t.category ? `${t.category.emoji} ${t.category.name}` : "Uncategorized"}
                                </Badge>
                              )}
                            </div>

                            {/* Amount */}
                            <div className={`flex-shrink-0 font-semibold tabular-nums text-right w-24 text-sm ${isExpense ? "text-rose-500" : "text-emerald-600"}`}>
                              {isExpense ? "-" : "+"}
                              {formatCurrency(t.amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-5 mt-5 border-t">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
