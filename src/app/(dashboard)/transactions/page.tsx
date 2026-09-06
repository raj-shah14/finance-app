"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
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
  ChevronDown,
} from "lucide-react";
import { formatCurrencyDetail as formatCurrency } from "@/lib/format";
import { HeroCard } from "@/components/dashboard/hero-card";

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
  | "thisWeek"
  | "thisMonth"
  | "lastMonth"
  | "last30"
  | "last90"
  | "thisYear"
  | "custom";

const DATE_PRESETS: { key: DatePresetKey; label: string; range: () => { start: string; end: string } | null }[] = [
  {
    key: "thisWeek",
    // Rolling last 7 days (including today), matching the Dashboard's
    // "This week" tile — not a calendar Sun-Sat week — so the number you
    // click through from is exactly the transactions summed into it.
    label: "This week",
    range: () => ({ start: ymd(subDays(new Date(), 6)), end: ymd(new Date()) }),
  },
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

function defaultRange(): { start: string; end: string } {
  return { start: ymd(startOfMonth(new Date())), end: ymd(endOfMonth(new Date())) };
}

// Seeds the very first render with a `?range=` preset already applied
// (e.g. arriving fresh from the Dashboard's "This week" tile) so the
// initial fetch uses the right dates instead of firing once with the
// default month range and once more a moment later with the real one.
// Read directly from window.location rather than useSearchParams so this
// can run inside a lazy useState initializer, before any hook that needs
// the router context is available.
function initialRange(): { start: string; end: string } {
  if (typeof window !== "undefined") {
    const requested = new URLSearchParams(window.location.search).get("range");
    const preset = DATE_PRESETS.find((p) => p.key === requested);
    const r = preset?.range();
    if (r) return r;
  }
  return defaultRange();
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

// Sentinel used to filter for transactions with no category assigned
// (categoryId IS NULL). This is distinct from the real "Uncategorized"
// category row in the DB — nothing ever auto-assigns transactions to that
// row (see PLAID_CATEGORY_MAP fallback), so filtering by its real id would
// always return zero rows even though the Expenses/Insights charts count
// null-category transactions under an "Uncategorized" label. We fold the
// real "Uncategorized" category into this same sentinel in the UI so there's
// a single filter option that actually matches what the charts show.
const UNCATEGORIZED_ID = "uncategorized";
const UNCATEGORIZED_CATEGORY: Category = { id: UNCATEGORIZED_ID, name: "Uncategorized", emoji: "❓", color: "#9ca3af" };

function categoryFilterId(cat: Category): string {
  return cat.name === "Uncategorized" ? UNCATEGORIZED_ID : cat.id;
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
  summary?: { spent: number; received: number; net: number };
}

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
  const [summary, setSummary] = useState<{ spent: number; received: number; net: number }>({ spent: 0, received: 0, net: 0 });
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(() => initialRange().start);
  const [endDate, setEndDate] = useState(() => initialRange().end);
  const searchParams = useSearchParams();
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"personal" | "household">("personal");
  const [categories, setCategories] = useState<Category[]>([]);
  const [persons, setPersons] = useState<{ id: string; name: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Guards against out-of-order responses: navigating here with a `?range=`
  // param fires a fetch for the default range, then immediately another for
  // the corrected one once the URL-param effect below runs. Nothing
  // otherwise stops the first (wrong) response from resolving after the
  // second (correct) one and clobbering it — bump this on every fetch and
  // ignore any response that isn't from the most recent call.
  const fetchRequestId = useRef(0);

  const activePreset = detectPreset(startDate, endDate);

  // Apply a `?range=` preset whenever it's present in the URL — not just on
  // first mount. Next's client-side router can reuse this page's already-
  // mounted component instance when navigating here via <Link> (e.g. from
  // the Dashboard's "This week" tile), so a lazy useState initializer alone
  // only fires once and misses a second visit with a different `range`.
  const requestedRange = searchParams.get("range");
  useEffect(() => {
    if (!requestedRange) return;
    const preset = DATE_PRESETS.find((p) => p.key === requestedRange);
    const r = preset?.range();
    if (r) {
      setStartDate(r.start);
      setEndDate(r.end);
    }
  }, [requestedRange]);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => { if (data.categories) setCategories(data.categories); })
      .catch(() => {});
  }, []);

  const fetchTransactions = useCallback(async () => {
    const requestId = ++fetchRequestId.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      params.set("viewMode", viewMode);
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (categoryIds.length > 0) params.set("categoryIds", categoryIds.join(","));
      if (userId) params.set("userId", userId);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: TransactionsResponse = await res.json();

      // A newer fetch has since been kicked off (e.g. the ?range= preset
      // effect updated startDate/endDate right after this request started)
      // — this response is stale, don't let it clobber the newer one.
      if (fetchRequestId.current !== requestId) return;

      setTransactions(data.transactions);
      setTotalPages(data.totalPages);
      setTotal(data.total);
      setSummary(
        data.summary ?? data.transactions.reduce(
          (acc, t) => {
            if (t.amount > 0) acc.spent += t.amount;
            else acc.received += -t.amount;
            acc.net = acc.received - acc.spent;
            return acc;
          },
          { spent: 0, received: 0, net: 0 }
        )
      );

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
      if (fetchRequestId.current === requestId) setLoading(false);
    }
  }, [page, search, startDate, endDate, categoryIds, userId, viewMode]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { setPage(1); }, [search, startDate, endDate, categoryIds, userId, viewMode]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      const failedProviders = (data.results ?? []).filter(
        (result: { ok?: boolean }) => !result.ok
      );
      if (!res.ok || failedProviders.length > 0) {
        const details = failedProviders
          .map((result: { provider?: string; data?: { error?: string; code?: string } }) => {
            const provider = result.provider ? `${result.provider}: ` : "";
            const code = result.data?.code ? ` (${result.data.code})` : "";
            return `${provider}${result.data?.error || "Sync failed"}${code}`;
          })
          .join("\n");
        throw new Error(details || data.error || "Sync failed");
      }
      await fetchTransactions();
    } catch (err) {
      console.error("Sync error:", err);
      alert(err instanceof Error ? err.message : "Sync failed");
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

  // Filter-wide totals come from the API (`summary`); fall back to page sums.
  const pageTotals = summary;

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
  categoryIds.forEach((id) => {
    const c = id === UNCATEGORIZED_ID
      ? UNCATEGORIZED_CATEGORY
      : categories.find((x) => x.id === id);
    if (c) {
      activeFilters.push({
        key: `cat-${id}`,
        label: `${c.emoji} ${c.name}`,
        clear: () => setCategoryIds((prev) => prev.filter((x) => x !== id)),
      });
    }
  });
  if (userId) {
    const p = persons.find((x) => x.id === userId);
    if (p) activeFilters.push({ key: "user", label: p.name, clear: () => setUserId("") });
  }

  const clearAll = () => {
    setSearch("");
    setCategoryIds([]);
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

      {/* Hero: spent, for the current filter/date range */}
      <HeroCard
        eyebrow="Spent"
        value={formatCurrency(pageTotals.spent)}
        subline={`${formatCurrency(pageTotals.received)} received · ${total.toLocaleString()} ${total === 1 ? "transaction" : "transactions"}`}
      />

      {/* Net */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className={`text-base font-bold tabular-nums ${pageTotals.net < 0 ? "text-rose-500" : ""}`}>
            {pageTotals.net < 0 ? "-" : ""}{formatCurrency(pageTotals.net)}
          </p>
          <p className="text-xs text-muted-foreground">Net</p>
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
              {(categoryIds.length > 0 || userId) && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                  {categoryIds.length + (userId ? 1 : 0)}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {categoryIds.length === 0
                          ? "All Categories"
                          : categoryIds.length === 1
                            ? (() => {
                                const c = categoryIds[0] === UNCATEGORIZED_ID
                                  ? UNCATEGORIZED_CATEGORY
                                  : categories.find((x) => x.id === categoryIds[0]);
                                return c ? `${c.emoji} ${c.name}` : "1 selected";
                              })()
                            : `${categoryIds.length} selected`}
                      </span>
                      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 overflow-y-auto" align="start">
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>Categories</span>
                      {categoryIds.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setCategoryIds([]); }}
                          className="text-xs font-normal text-muted-foreground hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {categories.map((cat) => {
                      const filterId = categoryFilterId(cat);
                      return (
                        <DropdownMenuCheckboxItem
                          key={cat.id}
                          checked={categoryIds.includes(filterId)}
                          onCheckedChange={(checked) => {
                            setCategoryIds((prev) =>
                              checked ? [...prev, filterId] : prev.filter((x) => x !== filterId)
                            );
                          }}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {cat.emoji} {cat.name}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
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
                    <div className="rounded-xl border overflow-hidden">
                      {/* Day header */}
                      <div className="flex items-center justify-between px-3 py-2 sticky top-0 bg-background/90 backdrop-blur-sm border-b z-10">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {dayHeaderLabel(date)}
                        </p>
                        <p className={`text-xs font-semibold tabular-nums ${dayNet > 0 ? "text-rose-500" : dayNet < 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                          {dayNet > 0 ? "-" : dayNet < 0 ? "+" : ""}{formatCurrency(dayNet)}
                        </p>
                      </div>

                      {/* Day's transactions */}
                      <div className="divide-y">
                      {txs.map((t) => {
                        const isExpense = t.amount > 0;
                        const tile = t.category?.color ?? "#9ca3af";
                        return (
                          <div key={t.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-3 py-2.5 hover:bg-muted/40 transition-colors">
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
                            </div>

                            {/* Amount (mobile: inline next to merchant) */}
                            <div className={`sm:hidden flex-shrink-0 font-semibold tabular-nums text-right text-sm ${isExpense ? "text-rose-500" : "text-emerald-600"}`}>
                              {isExpense ? "-" : "+"}
                              {formatCurrency(t.amount)}
                            </div>

                            {/* Category pill / inline editor — full width on mobile, fixed on desktop */}
                            <div className="order-last sm:order-none w-full sm:w-[170px] sm:flex-shrink-0">
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
                                  className="cursor-pointer hover:bg-muted-foreground/20 transition-colors w-full justify-start truncate"
                                  onClick={() => setEditingCategoryId(t.id)}
                                >
                                  {t.category ? `${t.category.emoji} ${t.category.name}` : "Uncategorized"}
                                </Badge>
                              )}
                            </div>

                            {/* Amount (desktop only) */}
                            <div className={`hidden sm:block flex-shrink-0 font-semibold tabular-nums text-right w-24 text-sm ${isExpense ? "text-rose-500" : "text-emerald-600"}`}>
                              {isExpense ? "-" : "+"}
                              {formatCurrency(t.amount)}
                            </div>
                          </div>
                        );
                      })}
                      </div>
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
