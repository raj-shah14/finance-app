"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { format } from "date-fns";
import { Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

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
  account: {
    name: string;
    mask: string;
    type: string;
  };
  user: {
    firstName: string;
    lastName: string;
  };
}

interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"personal" | "household">("household");

  // Derive categories and persons from fetched transactions
  const [categories, setCategories] = useState<Category[]>([]);
  const [persons, setPersons] = useState<{ id: string; name: string }[]>([]);

  // Fetch all categories from DB (includes custom ones)
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories);
      })
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

      // Build unique persons
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

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, startDate, endDate, categoryId, userId, viewMode]);

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

  const handleCategoryChange = async (
    transactionId: string,
    newCategoryId: string
  ) => {
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
            ? {
                ...t,
                categoryId: newCategoryId,
                category:
                  categories.find((c) => c.id === newCategoryId) ?? t.category,
              }
            : t
        )
      );
    } catch (err) {
      console.error("Error updating category:", err);
    } finally {
      setEditingCategoryId(null);
    }
  };

  const formatAmount = (amount: number) => {
    const absAmount = Math.abs(amount);
    return `$${absAmount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            💳 Transactions
          </h1>
          <p className="text-muted-foreground mt-1">
            {total} transaction{total !== 1 ? "s" : ""} found
            {viewMode === "household" ? " (shared)" : " (personal)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "personal" | "household")}>
            <TabsList>
              <TabsTrigger value="personal" className="gap-1.5">👤 Personal</TabsTrigger>
              <TabsTrigger value="household" className="gap-1.5">🏠 Household</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            <RefreshCw
            className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing..." : "Sync"}
        </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Start Date */}
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start date"
            />

            {/* End Date */}
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End date"
            />

            {/* Category Filter */}
            <Select
              value={categoryId || "all"}
              onValueChange={(val) => setCategoryId(val === "all" ? "" : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.emoji} {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Person Filter */}
            <Select
              value={userId || "all"}
              onValueChange={(val) => setUserId(val === "all" ? "" : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {persons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-muted-foreground font-medium">
                No transactions found
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters or sync your accounts.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {transactions.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                >
                  {/* Category emoji */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                    {t.category?.emoji ?? "❓"}
                  </div>

                  {/* Name & Account */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {t.merchantName ?? t.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {t.account.name} ••{t.account.mask}
                      {viewMode === "household" && t.user && (
                        <span className="ml-1.5">· {t.user.firstName}</span>
                      )}
                    </p>
                  </div>

                  {/* Category badge */}
                  <div className="hidden sm:block flex-shrink-0">
                    {editingCategoryId === t.id ? (
                      <Select
                        value={t.categoryId ?? ""}
                        onValueChange={(val) => handleCategoryChange(t.id, val)}
                        onOpenChange={(open) => {
                          if (!open) setEditingCategoryId(null);
                        }}
                        defaultOpen
                      >
                        <SelectTrigger className="h-7 w-[160px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.emoji} {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-muted-foreground/20 transition-colors"
                        onClick={() => setEditingCategoryId(t.id)}
                      >
                        {t.category
                          ? `${t.category.emoji} ${t.category.name}`
                          : "Uncategorized"}
                      </Badge>
                    )}
                  </div>

                  {/* Date */}
                  <div className="hidden md:block flex-shrink-0 text-sm text-muted-foreground w-24 text-right">
                    {format(new Date(t.date), "MMM d, yyyy")}
                  </div>

                  {/* Amount */}
                  <div
                    className={`flex-shrink-0 font-semibold tabular-nums text-right w-24 ${
                      t.amount > 0 ? "text-red-500" : "text-green-500"
                    }`}
                  >
                    {t.amount > 0 ? "-" : "+"}
                    {formatAmount(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
