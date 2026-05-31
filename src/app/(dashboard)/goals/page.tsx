"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Pencil, Target, Home, Car, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency, CATEGORICAL_COLORS } from "@/lib/format";

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  currentBalance: number | null;
  plaidItem?: { institutionName: string | null };
}

interface Goal {
  id: string;
  name: string;
  kind: "savings" | "payoff" | "custom";
  cadence: "one_time" | "monthly" | "quarterly" | "yearly";
  targetAmount: number;
  currentAmount: number;
  percentage: number;
  linkedAccountId: string | null;
  linkedAccount: Account | null;
  merchantPatterns?: string[];
  color: string | null;
  sortOrder: number;
}

interface GoalFormState {
  id?: string;
  name: string;
  kind: "savings" | "payoff" | "custom";
  cadence: "one_time" | "monthly" | "quarterly" | "yearly";
  targetAmount: string;
  currentAmount: string;
  linkedAccountId: string;
  merchantPatterns: string;
}

const EMPTY_FORM: GoalFormState = {
  name: "",
  kind: "savings",
  cadence: "one_time",
  targetAmount: "",
  currentAmount: "",
  linkedAccountId: "none",
  merchantPatterns: "",
};

function GoalIcon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const lower = name.toLowerCase();
  if (lower.includes("house") || lower.includes("mortgage") || lower.includes("home")) {
    return <Home className={className} />;
  }
  if (lower.includes("car") || lower.includes("auto") || lower.includes("vehicle")) {
    return <Car className={className} />;
  }
  if (lower.includes("emergency") || lower.includes("savings")) {
    return <PiggyBank className={className} />;
  }
  if (lower.includes("retirement") || lower.includes("invest")) {
    return <TrendingUp className={className} />;
  }
  return <Target className={className} />;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/goals").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ])
      .then(([g, a]) => {
        setGoals(g.goals || []);
        setAccounts(a.accounts || []);
      })
      .catch(() => {
        setGoals([]);
        setAccounts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function openNew() {
    setForm(EMPTY_FORM);
    setError(null);
    setDialogOpen(true);
  }
  function openEdit(g: Goal) {
    setForm({
      id: g.id,
      name: g.name,
      kind: g.kind,
      cadence: g.cadence ?? "one_time",
      targetAmount: String(g.targetAmount),
      currentAmount: g.linkedAccountId ? "" : String(g.currentAmount ?? ""),
      linkedAccountId: g.linkedAccountId ?? "none",
      merchantPatterns: (g.merchantPatterns ?? []).join(", "),
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setError(null);
    const target = parseFloat(form.targetAmount);
    if (!form.name.trim() || !Number.isFinite(target) || target <= 0) {
      setError("Name and a positive target amount are required");
      return;
    }
    setSaving(true);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      kind: form.kind,
      cadence: form.cadence,
      targetAmount: target,
      linkedAccountId:
        form.linkedAccountId === "none" ? null : form.linkedAccountId,
      merchantPatterns: form.merchantPatterns
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
    };
    // Only send manual currentAmount when no account is linked.
    if (form.linkedAccountId === "none" && form.currentAmount.trim()) {
      const c = parseFloat(form.currentAmount);
      if (Number.isFinite(c)) body.currentAmount = c;
    } else {
      body.currentAmount = null;
    }

    const url = form.id ? `/api/goals/${form.id}` : "/api/goals";
    const method = form.id ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDialogOpen(false);
        fetchAll();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || `Failed (${res.status}). Restart the dev server if you just added the Goal model.`);
      }
    } catch (err) {
      setError((err as Error)?.message || "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    fetchAll();
  }

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalProgress = goals.reduce((s, g) => s + g.currentAmount, 0);
  const overallPct =
    totalTarget > 0 ? Math.round((totalProgress / totalTarget) * 100) : 0;

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financial Goals</h1>
            <p className="text-xs text-muted-foreground">
              Track savings targets and debt payoff progress
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              New Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit goal" : "New goal"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="goal-name">Name</Label>
                <Input
                  id="goal-name"
                  placeholder="House Mortgage"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="goal-kind">Kind</Label>
                  <Select
                    value={form.kind}
                    onValueChange={(v) =>
                      setForm({ ...form, kind: v as GoalFormState["kind"] })
                    }
                  >
                    <SelectTrigger id="goal-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">
                        Savings — accumulate toward a target
                      </SelectItem>
                      <SelectItem value="payoff">
                        Payoff — pay down a loan / debt
                      </SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="goal-cadence">Cadence</Label>
                  <Select
                    value={form.cadence}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        cadence: v as GoalFormState["cadence"],
                      })
                    }
                  >
                    <SelectTrigger id="goal-cadence">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">
                        One-time — cumulative target
                      </SelectItem>
                      <SelectItem value="monthly">
                        Monthly — resets every month
                      </SelectItem>
                      <SelectItem value="quarterly">
                        Quarterly — resets every quarter
                      </SelectItem>
                      <SelectItem value="yearly">
                        Yearly — resets every year
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="goal-target">
                  {form.kind === "payoff"
                    ? "Original loan amount ($)"
                    : form.cadence === "one_time"
                      ? "Target amount ($)"
                      : `Target per ${form.cadence.replace("ly", "")}/period ($)`}
                </Label>
                <Input
                  id="goal-target"
                  type="number"
                  inputMode="decimal"
                  placeholder={form.cadence === "monthly" ? "500" : "500000"}
                  value={form.targetAmount}
                  onChange={(e) =>
                    setForm({ ...form, targetAmount: e.target.value })
                  }
                />
                {form.cadence !== "one_time" && (
                  <p className="text-[11px] text-muted-foreground">
                    Progress resets at the start of every {form.cadence === "monthly" ? "month" : form.cadence === "quarterly" ? "quarter" : "year"} (Jan 1 / first of period).
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="goal-account">Linked account (optional)</Label>
                <Select
                  value={form.linkedAccountId}
                  onValueChange={(v) => setForm({ ...form, linkedAccountId: v })}
                >
                  <SelectTrigger id="goal-account">
                    <SelectValue placeholder="None — enter progress manually" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      None — enter progress manually
                    </SelectItem>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.plaidItem?.institutionName ?? a.name}
                        {a.mask ? ` ····${a.mask}` : ""} · {a.type}
                        {a.subtype ? `/${a.subtype}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {form.kind === "payoff"
                    ? "Pick the loan/credit account: progress = target − current balance."
                    : "Pick a savings/investment account: progress = current balance."}
                </p>
              </div>
              {form.linkedAccountId === "none" && (
                <div className="space-y-1">
                  <Label htmlFor="goal-current">Current progress ($)</Label>
                  <Input
                    id="goal-current"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={form.currentAmount}
                    onChange={(e) =>
                      setForm({ ...form, currentAmount: e.target.value })
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Used when no linked account and no merchant patterns are configured.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="goal-patterns">Merchant patterns (optional)</Label>
                <Input
                  id="goal-patterns"
                  placeholder="Ally Bank Transfer, Marcus"
                  value={form.merchantPatterns}
                  onChange={(e) =>
                    setForm({ ...form, merchantPatterns: e.target.value })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Comma-separated. Any transaction matching these counts toward this goal
                  {form.cadence !== "one_time" && (
                    <> (limited to the current {form.cadence === "monthly" ? "month" : form.cadence === "quarterly" ? "quarter" : "year"})</>
                  )}.
                </p>
              </div>
              {error && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-md px-2 py-1.5">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.targetAmount}>
                {saving ? "Saving…" : form.id ? "Save changes" : "Add goal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900/40 px-3 py-2">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Goals</p>
          <p className="text-lg font-bold text-indigo-600 dark:text-indigo-300 tabular-nums">{goals.length}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Overall progress</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-300 tabular-nums">{overallPct}%</p>
          <p className="text-[11px] text-muted-foreground">
            {formatCurrency(totalProgress)} of {formatCurrency(totalTarget)}
          </p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-100 dark:border-orange-900/40 px-3 py-2">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Remaining</p>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-300 tabular-nums">
            {formatCurrency(Math.max(0, totalTarget - totalProgress))}
          </p>
        </div>
      </div>

      {/* Goals list */}
      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wallet className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium">No goals yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first goal — a savings target or a mortgage/loan payoff
            </p>
            <Button onClick={openNew} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Goal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {goals.map((g, i) => {
            const color = g.color || CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length];
            return (
              <Card key={g.id}>
                <CardHeader className="pb-2 pt-4 px-5 flex-row items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                      style={{ background: color + "22", color }}
                    >
                      <GoalIcon name={g.name} />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold truncate">{g.name}</CardTitle>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {g.kind}
                        {g.cadence && g.cadence !== "one_time" && (
                          <> · {g.cadence}</>
                        )}
                        {g.linkedAccount && (
                          <> · {g.linkedAccount.plaidItem?.institutionName ?? g.linkedAccount.name}{g.linkedAccount.mask ? ` ····${g.linkedAccount.mask}` : ""}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(g)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-rose-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {formatCurrency(g.currentAmount)}
                      <span className="text-muted-foreground/60"> / {formatCurrency(g.targetAmount)}</span>
                    </span>
                    <span className="font-bold tabular-nums">{g.percentage}%</span>
                  </div>
                  <Progress
                    value={g.percentage}
                    className="h-2 [&>[data-slot=progress-indicator]]:transition-all"
                    style={{ ["--progress-color" as string]: color } as React.CSSProperties}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Remaining: {formatCurrency(Math.max(0, g.targetAmount - g.currentAmount))}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
