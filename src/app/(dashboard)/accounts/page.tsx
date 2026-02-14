"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { Trash2, CreditCard, Building2, Wallet } from "lucide-react";
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Total Depository
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(depositoryTotal)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Credit Card Debt
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(creditTotal)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Worth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    netWorth >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(netWorth)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Account Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((account) => (
              <Card key={account.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {account.name}
                        {account.mask && (
                          <span className="text-muted-foreground font-normal ml-2">
                            ••••{account.mask}
                          </span>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        {account.plaidItem.institutionName}
                      </div>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {accountTypeLabel(account.type, account.subtype)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold">
                      {formatCurrency(account.currentBalance)}
                    </p>
                    {account.availableBalance !== null && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(account.availableBalance)} available
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      {account.user.firstName} {account.user.lastName}
                    </span>
                    {account.plaidItem.lastSyncedAt && (
                      <span>
                        Synced{" "}
                        {formatDistanceToNow(
                          new Date(account.plaidItem.lastSyncedAt),
                          { addSuffix: true }
                        )}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(account.id)}
                      disabled={deletingId === account.id}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      {deletingId === account.id ? "Removing…" : "Remove"}
                    </Button>
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
