"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { formatCurrencyDetail as formatCurrency, MONTH_NAMES } from "@/lib/format";
import { HeroCard, TrendPill, ChipRow } from "@/components/dashboard/hero-card";
import { MonthPicker } from "@/components/dashboard/month-picker";

interface Budget {
  id: string;
  categoryId: string;
  category: { name: string; emoji: string; color: string };
  monthlyLimit: number;
  spent: number;
  percentage: number;
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export default function BudgetsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [prevTotalSpent, setPrevTotalSpent] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => { if (d.categories) setCategories(d.categories); })
      .catch(() => {});
  }, []);

  const fetchBudgets = async () => {
    setLoading(true);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    try {
      const [res, prevRes] = await Promise.all([
        fetch(`/api/budgets?month=${month}&year=${year}`),
        fetch(`/api/budgets?month=${prevMonth}&year=${prevYear}`),
      ]);
      const data = await res.json();
      const prevData = await prevRes.json();
      setBudgets(data.budgets || []);
      const prevBudgets: Budget[] = prevData.budgets || [];
      setPrevTotalSpent(
        prevBudgets.length > 0 ? prevBudgets.reduce((s, b) => s + b.spent, 0) : null
      );
    } catch {
      setBudgets([]);
      setPrevTotalSpent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [month, year]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const openNew = () => {
    setEditingBudget(null);
    setSelectedCategory("");
    setMonthlyLimit("");
    setDialogOpen(true);
  };

  const openEdit = (budget: Budget) => {
    setEditingBudget(budget);
    setSelectedCategory(budget.categoryId);
    setMonthlyLimit(String(budget.monthlyLimit));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCategory || !monthlyLimit) return;
    setSaving(true);
    try {
      // POST is an upsert keyed on (categoryId, userId, month, year), so
      // this same call both creates a new budget and edits an existing one.
      await fetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory,
          monthlyLimit: parseFloat(monthlyLimit),
          month,
          year,
        }),
      });
      setDialogOpen(false);
      setEditingBudget(null);
      setSelectedCategory("");
      setMonthlyLimit("");
      await fetchBudgets();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (budget: Budget, scope: "event" | "series") => {
    setDeleting(true);
    try {
      await fetch("/api/budgets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: budget.categoryId, month, year, scope }),
      });
      setDeleteTarget(null);
      await fetchBudgets();
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  };

  // isOver must come from the exact spent/limit dollar comparison, not the
  // rounded display percentage — e.g. $4,293.10 spent of a $4,294.00 limit
  // is 99.98%, which rounds to a displayed "100%" but is not actually over.
  const getProgressColor = (percentage: number, isOver: boolean) => {
    if (isOver) return "[&>[data-slot=progress-indicator]]:bg-red-500";
    if (percentage >= 75) return "[&>[data-slot=progress-indicator]]:bg-yellow-500";
    return "[&>[data-slot=progress-indicator]]:bg-emerald-500";
  };

  const getBadgeStyle = (isOver: boolean) => (isOver ? ("destructive" as const) : ("secondary" as const));

  const getBadgeClassName = (percentage: number, isOver: boolean) => {
    if (isOver) return "";
    if (percentage >= 75)
      return "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  };

  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
  const spentChangePct =
    prevTotalSpent && prevTotalSpent > 0
      ? Math.round(((totalSpent - prevTotalSpent) / prevTotalSpent) * 100)
      : null;
  const topCategories = [...budgets].sort((a, b) => b.spent - a.spent).slice(0, 3);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
            <p className="text-xs text-muted-foreground">{MONTH_NAMES[month - 1]} {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker month={month} year={year} onPrev={handlePrevMonth} onNext={handleNextMonth} />

          {/* Add / Edit Budget */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingBudget(null); }}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBudget ? "Edit Budget" : "Add Budget"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  {editingBudget ? (
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                      <span>{editingBudget.category.emoji}</span>
                      <span>{editingBudget.category.name}</span>
                    </div>
                  ) : (
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                          .filter((cat) => !budgets.some((b) => b.categoryId === cat.id))
                          .map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.emoji} {cat.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit">Monthly Limit ($)</Label>
                  <Input
                    id="limit"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={!selectedCategory || !monthlyLimit || saving}
                  className="w-full"
                >
                  {saving ? "Saving..." : editingBudget ? "Save changes" : "Save Budget"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Hero: total spent of total plan, vs last month */}
      {budgets.length > 0 && (
        <div className="space-y-4">
          <HeroCard
            eyebrow={`${MONTH_NAMES[month - 1]} spending`}
            value={formatCurrency(totalSpent)}
            subline={`of ${formatCurrency(totalLimit)} plan`}
            pill={spentChangePct !== null ? <TrendPill changePercent={spentChangePct} /> : undefined}
          />
          <ChipRow
            title="Where it went"
            chips={topCategories.map((b) => ({
              key: b.id,
              label: `${b.category.emoji} ${b.category.name}`,
              value: formatCurrency(b.spent),
            }))}
          />
        </div>
      )}

      {/* Budget Cards */}
      {budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground text-center text-lg">
              No budgets set yet. Click &apos;Add Budget&apos; to start tracking! 📊
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const isOver = budget.spent > budget.monthlyLimit;
            return (
              <Card
                key={budget.id}
                className={`relative ${isOver ? "border-red-400 dark:border-red-600" : ""}`}
              >
                <div className="absolute top-2 right-2 flex items-center gap-1 z-10 rounded-full bg-background/80 backdrop-blur-sm shadow-sm border border-border/50 p-0.5">
                  <button
                    onClick={() => openEdit(budget)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(budget)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-rose-600"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 pr-16">
                  <CardTitle className="text-sm font-medium">
                    <span className="text-xl mr-2">{budget.category.emoji}</span>
                    {budget.category.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isOver ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    )}
                    <Badge
                      variant={getBadgeStyle(isOver)}
                      className={`text-xs ${getBadgeClassName(budget.percentage, isOver)}`}
                    >
                      {budget.percentage}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress
                    value={Math.min(budget.percentage, 100)}
                    className={`h-2.5 ${getProgressColor(budget.percentage, isOver)}`}
                  />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatCurrency(budget.spent)} spent
                    </span>
                    <span className="font-medium">
                      {formatCurrency(budget.monthlyLimit)} limit
                    </span>
                  </div>
                  {isOver && (
                    <p className="text-xs text-red-500 font-medium">
                      Over budget by {formatCurrency(budget.spent - budget.monthlyLimit)}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete confirmation: this month's occurrence vs the whole series */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {deleteTarget?.category.emoji} {deleteTarget?.category.name} budget?
            </DialogTitle>
            <DialogDescription>
              Remove just {MONTH_NAMES[month - 1]} {year}, or this category&apos;s budget
              for every month (past and future).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:flex-col gap-2">
            <Button
              variant="outline"
              className="w-full justify-center"
              disabled={deleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget, "event")}
            >
              Delete this month only
            </Button>
            <Button
              variant="destructive"
              className="w-full justify-center"
              disabled={deleting}
              onClick={() => deleteTarget && handleDelete(deleteTarget, "series")}
            >
              Delete completely (all months)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
