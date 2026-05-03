"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { Trash2, CreditCard, Building2, Wallet, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Account {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  plaidItem: {
    institutionName: string;
    lastSyncedAt: string | null;
  };
  user: {
    firstName: string;
    lastName: string;
  };
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function accountTypeLabel(type: string, subtype: string | null) {
  if (subtype) return subtype.replace(/_/g, " ");
  return type;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleDelete = async (accountId: string) => {
    if (!confirm("Are you sure you want to remove this account?")) return;
    setDeletingId(accountId);
    try {
      await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } catch (error) {
      console.error("Failed to delete account:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const depositoryTotal = accounts
    .filter((a) => a.type === "depository")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const creditTotal = accounts
    .filter((a) => a.type === "credit")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const netWorth = depositoryTotal - creditTotal;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Loading accounts…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏦 Connected Accounts</h1>
        <PlaidLinkButton onSuccess={fetchAccounts} />
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No accounts connected yet. Use the button above to link your bank!
              🏦
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Totals Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Total Depository</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums break-all">
                      {formatCurrency(depositoryTotal)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/50 p-2 shrink-0">
                    <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Credit Card Debt</p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums break-all">
                      {formatCurrency(creditTotal)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-rose-100 dark:bg-rose-900/50 p-2 shrink-0">
                    <CreditCard className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">Net Worth</p>
                    <p className={`text-lg sm:text-xl lg:text-2xl font-bold mt-0.5 tabular-nums break-all ${netWorth >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {formatCurrency(netWorth)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-indigo-100 dark:bg-indigo-900/50 p-2 shrink-0">
                    <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((account) => (
              <Card key={account.id} className="relative overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(account.id)}
                  disabled={deletingId === account.id}
                  aria-label="Remove account"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>

                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-start gap-2 pr-6">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-semibold leading-snug">
                        {account.name}
                        {account.mask && (
                          <span className="text-muted-foreground font-normal ml-1.5 text-xs">
                            ••••{account.mask}
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">{account.plaidItem.institutionName}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize text-xs shrink-0">
                      {accountTypeLabel(account.type, account.subtype)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1.5">
                  <div>
                    <p className="text-xl font-bold">{formatCurrency(account.currentBalance)}</p>
                    {account.availableBalance !== null && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(account.availableBalance)} available
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{account.user.firstName} {account.user.lastName}</span>
                    {account.plaidItem.lastSyncedAt && (
                      <span className="shrink-0 ml-2">
                        Synced {formatDistanceToNow(new Date(account.plaidItem.lastSyncedAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
