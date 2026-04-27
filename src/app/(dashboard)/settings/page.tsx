"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Users, Plus, Trash2, RefreshCw, Mail, Crown, UserMinus, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlaidLinkButton } from "@/components/plaid/plaid-link-button";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

interface CustomCategory {
  id?: string;
  name: string;
  emoji: string;
  color: string;
  sharedWithHousehold: boolean;
}

interface PlaidItem {
  id: string;
  institutionName: string;
  lastSynced: string | null;
  accountIds: string[];
}

interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt?: string;
}

interface Household {
  id: string;
  name: string;
  createdAt: string;
  members: HouseholdMember[];
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const clerk = useClerk();

  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCategory, setNewCategory] = useState<CustomCategory>({ name: "", emoji: "📌", color: "#6366f1", sharedWithHousehold: true });
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  // null = creating new; otherwise editing this category. When set, the
  // dialog reuses `newCategory` state to drive the form.
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(null);

  const defaultCategoryNames = new Set(DEFAULT_CATEGORIES.map((c) => c.name));

  const fetchCustomCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        const custom = (data.categories ?? [])
          .filter((c: any) => !c.isDefault && !defaultCategoryNames.has(c.name))
          .map((c: any) => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color, sharedWithHousehold: true }));
        setCustomCategories(custom);
      }
    } catch {
      // handle error silently
    }
  }, []);

  useEffect(() => {
    fetchCustomCategories();
  }, [fetchCustomCategories]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(true);
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const [sharingPrefs, setSharingPrefs] = useState<Map<string, boolean>>(new Map());
  const [sharingCategories, setSharingCategories] = useState<Array<{ categoryId: string; categoryName: string; emoji: string }>>([]);
  const [shareIncome, setShareIncome] = useState(false);
  const [shareNetSavings, setShareNetSavings] = useState(false);

  const [sentInvites, setSentInvites] = useState<Array<{
    id: string;
    email: string;
    status: string;
    createdAt: string;
  }>>([]);

  const fetchHousehold = useCallback(async () => {
    try {
      setHouseholdLoading(true);
      const res = await fetch("/api/household");
      if (res.ok) {
        const data = await res.json();
        setHousehold(data.household);
      }
    } catch {
      // handle error silently
    } finally {
      setHouseholdLoading(false);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/invites");
      if (res.ok) {
        const data = await res.json();
        setSentInvites(data.invites ?? []);
      }
    } catch {
      // handle error silently
    }
  }, []);

  const fetchPlaidItems = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = await res.json();
        const accounts = data.accounts ?? [];
        // Group by institution
        const itemMap = new Map<string, PlaidItem>();
        for (const acct of accounts) {
          const name = acct.plaidItem?.institutionName || "Unknown";
          if (!itemMap.has(name)) {
            itemMap.set(name, {
              id: name,
              institutionName: name,
              lastSynced: acct.plaidItem?.lastSyncedAt || null,
              accountIds: [],
            });
          }
          itemMap.get(name)!.accountIds.push(acct.id);
        }
        setPlaidItems(Array.from(itemMap.values()));
        // Set last synced from most recent
        const synced = accounts
          .map((a: any) => a.plaidItem?.lastSyncedAt)
          .filter(Boolean)
          .sort()
          .pop();
        if (synced) setLastSynced(new Date(synced).toLocaleString());
      }
    } catch {
      // handle error silently
    }
  }, []);

  const handleRemoveInstitution = async (item: PlaidItem) => {
    if (!confirm(`Remove ${item.institutionName} and all its accounts?`)) return;
    try {
      for (const accountId of item.accountIds) {
        await fetch("/api/accounts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
      }
      await fetchPlaidItems();
    } catch {
      console.error("Failed to remove institution");
    }
  };

  useEffect(() => {
    fetchHousehold();
    fetchPlaidItems();
    fetchInvites();
  }, [fetchHousehold, fetchPlaidItems, fetchInvites]);

  const handleCreateHousehold = async () => {
    if (!newHouseholdName.trim()) return;
    try {
      const res = await fetch("/api/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newHouseholdName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setHousehold(data.household);
        setNewHouseholdName("");
        setCreateDialogOpen(false);
      }
    } catch {
      // handle error silently
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    try {
      const res = await fetch("/api/household", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) {
        setHousehold((prev) =>
          prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : null
        );
      }
    } catch {
      // handle error silently
    } finally {
      setRemovingMemberId(null);
    }
  };

  const fetchSharingPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/sharing");
      if (res.ok) {
        const data = await res.json();
        const prefs = data.preferences as { categoryId: string; categoryName: string; emoji: string; sharedWithHousehold: boolean }[];
        const map = new Map<string, boolean>();
        prefs.forEach((p) => map.set(p.categoryId, p.sharedWithHousehold));
        setSharingPrefs(map);
        setSharingCategories(prefs.map((p) => ({ categoryId: p.categoryId, categoryName: p.categoryName, emoji: p.emoji })));
        setShareIncome(data.shareIncome ?? false);
        setShareNetSavings(data.shareNetSavings ?? false);
      }
    } catch {
      // handle error silently
    }
  }, []);

  useEffect(() => {
    fetchSharingPrefs();
  }, [fetchSharingPrefs]);

  const handleToggleSharing = async (categoryId: string) => {
    const current = sharingPrefs.get(categoryId) ?? true;
    const newValue = !current;
    setSharingPrefs((prev) => {
      const next = new Map(prev);
      next.set(categoryId, newValue);
      return next;
    });
    try {
      await fetch("/api/sharing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, sharedWithHousehold: newValue }),
      });
    } catch {
      setSharingPrefs((prev) => {
        const next = new Map(prev);
        next.set(categoryId, current);
        return next;
      });
    }
  };

  const handleToggleFinancialSharing = async (field: "shareIncome" | "shareNetSavings") => {
    const setter = field === "shareIncome" ? setShareIncome : setShareNetSavings;
    const current = field === "shareIncome" ? shareIncome : shareNetSavings;
    setter(!current);
    try {
      await fetch("/api/sharing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !current }),
      });
    } catch {
      setter(current);
    }
  };

  useEffect(() => {
    // Placeholder: fetch connected Plaid items
  }, []);

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;

    // Edit mode — PATCH the existing category in place
    if (editingCategory?.id) {
      try {
        const res = await fetch("/api/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId: editingCategory.id,
            name: newCategory.name,
            emoji: newCategory.emoji,
            color: newCategory.color,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Failed to update category");
          return;
        }
        setCustomCategories((prev) =>
          prev.map((c) =>
            c.id === editingCategory.id
              ? { ...c, name: newCategory.name, emoji: newCategory.emoji, color: newCategory.color }
              : c
          )
        );
      } catch {
        alert("Failed to update category");
        return;
      }
      setEditingCategory(null);
      setNewCategory({ name: "", emoji: "📌", color: "#6366f1", sharedWithHousehold: true });
      setCategoryDialogOpen(false);
      return;
    }

    // Create mode
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategory.name, emoji: newCategory.emoji, color: newCategory.color }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to add category");
        return;
      }

      setCustomCategories((prev) => [...prev, { ...newCategory, id: data.category?.id }]);

      // Add sharing preference for the new category
      if (data.category?.id) {
        setSharingPrefs((prev) => {
          const next = new Map(prev);
          next.set(data.category.id, newCategory.sharedWithHousehold);
          return next;
        });
      }
    } catch {
      // handle error silently
    }

    setNewCategory({ name: "", emoji: "📌", color: "#6366f1", sharedWithHousehold: true });
    setCategoryDialogOpen(false);
  };

  const handleEditCategory = (cat: CustomCategory) => {
    setEditingCategory(cat);
    setNewCategory({
      name: cat.name,
      emoji: cat.emoji,
      color: cat.color,
      sharedWithHousehold: cat.sharedWithHousehold,
    });
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategory = async (cat: CustomCategory) => {
    if (!confirm(`Delete "${cat.name}"? Transactions using it will become uncategorized.`)) return;
    try {
      if (cat.id) {
        const res = await fetch("/api/categories", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryId: cat.id }),
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || "Failed to delete category");
          return;
        }
      }
      setCustomCategories((prev) => prev.filter((c) => c.name !== cat.name));
    } catch {
      alert("Failed to delete category");
    }
  };

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteError(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to send invite");
        return;
      }
      if (data.inviteLink) {
        setInviteLink(data.inviteLink);
      }
      setInviteEmail("");
      await fetchInvites();
    } catch {
      setInviteError("Failed to send invite");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Revoke this invite?")) return;
    try {
      const res = await fetch("/api/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (res.ok) {
        setSentInvites((prev) => prev.filter((i) => i.id !== inviteId));
      }
    } catch {
      // handle error silently
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      await fetch("/api/plaid/sync", { method: "POST" });
      setLastSynced(new Date().toLocaleString());
    } catch {
      // handle error silently
    } finally {
      setSyncing(false);
    }
  };

  // Determine if current user is owner
  const userEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;
  const isOwner = household?.members.some(
    (m) => m.email === userEmail && m.role === "owner"
  ) ?? false;

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">⚙️ Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Name</Label>
              <p className="font-medium">
                {!isLoaded ? "Loading…" : (user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—")}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="font-medium">
                {!isLoaded ? "Loading…" : (user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "—")}
              </p>
            </div>
          </div>
          <Separator />
          <Button variant="outline" onClick={() => clerk.openUserProfile()}>
            Manage Profile
          </Button>
        </CardContent>
      </Card>

      {/* Household */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Household
          </CardTitle>
          <CardDescription>Manage your household and invite members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {householdLoading ? (
            <p className="text-sm text-muted-foreground">Loading household…</p>
          ) : !household ? (
            /* No household — show create button */
            <div className="text-center py-6 space-y-3">
              <div className="text-4xl">🏠</div>
              <p className="text-sm text-muted-foreground">
                You don&apos;t belong to a household yet. Create one to start sharing finances.
              </p>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" /> Create Household
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create a Household</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="hh-name">Household Name</Label>
                      <Input
                        id="hh-name"
                        placeholder="e.g. Shah Family"
                        value={newHouseholdName}
                        onChange={(e) => setNewHouseholdName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateHousehold()}
                      />
                    </div>
                    <Button onClick={handleCreateHousehold} className="w-full" disabled={!newHouseholdName.trim()}>
                      Create Household
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            /* Household exists */
            <>
              <div>
                <Label className="text-muted-foreground text-xs">Household Name</Label>
                <p className="font-medium text-lg">{household.name}</p>
              </div>
              <Separator />

              {/* Invite section — only for owners */}
              {isOwner && (
                <>
                  <div className="space-y-2">
                    <Label>Invite a Member</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                      />
                      <Button onClick={handleInvite} disabled={!inviteEmail.trim()}>
                        <Mail className="h-4 w-4 mr-2" /> Invite
                      </Button>
                    </div>
                    {inviteError && (
                      <p className="text-sm text-destructive">{inviteError}</p>
                    )}
                    {inviteLink && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950 p-3 space-y-2">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                          ✅ Invite sent! Share this link:
                        </p>
                        <div className="flex gap-2">
                          <code className="flex-1 text-xs bg-white dark:bg-background rounded px-2 py-1.5 border truncate">
                            {inviteLink}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(inviteLink);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                          >
                            {copied ? "✅ Copied!" : "📋 Copy"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Open this link in an incognito window to test as the invited user
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Sent Invites */}
                  {sentInvites.length > 0 && (
                    <div className="space-y-2">
                      <Label>Sent Invites</Label>
                      {sentInvites.map((inv) => {
                        const isExpired = new Date() > new Date(new Date(inv.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
                        const statusLabel = isExpired ? "expired" : inv.status;
                        return (
                          <div key={inv.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{inv.email}</p>
                              <p className="text-xs text-muted-foreground">
                                Sent {new Date(inv.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                statusLabel === "accepted" ? "default" :
                                statusLabel === "expired" ? "destructive" : "secondary"
                              }>
                                {statusLabel}
                              </Badge>
                              {statusLabel === "pending" && (
                                <button
                                  onClick={() => handleRevokeInvite(inv.id)}
                                  className="text-muted-foreground hover:text-destructive transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Separator />
                </>
              )}

              {/* Members list */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Members
                  <Badge variant="outline" className="font-normal">
                    {household.members.length}
                  </Badge>
                </Label>
                {household.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === "owner" ? (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-300">
                          <Crown className="h-3 w-3 mr-1" /> Owner
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Member</Badge>
                      )}
                      {isOwner && member.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveMember(member.id)}
                          disabled={removingMemberId === member.id}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sharing Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>🔗 Sharing Preferences</CardTitle>
          <CardDescription>
            Choose which expense categories are visible in the household view. Private categories are only visible to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Financial visibility toggles */}
          <div className="space-y-2 pb-3 mb-3 border-b">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Financial Summary</p>
            {[
              { key: "shareIncome" as const, label: "Income", emoji: "💵", desc: "Show your income in household view", value: shareIncome },
              { key: "shareNetSavings" as const, label: "Net Savings", emoji: "💰", desc: "Show your net savings in household view", value: shareNetSavings },
            ].map((item) => (
              <div
                key={item.key}
                className={`flex items-center justify-between rounded-md border px-4 py-3 ${
                  item.value ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.emoji}</span>
                  <div>
                    <span className="text-sm font-medium">{item.label}</span>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleFinancialSharing(item.key)}
                >
                  {item.value ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">🔓 Shared</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">🔒 Private</Badge>
                  )}
                </Button>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Expense Categories</p>
          {sharingCategories.map((cat) => {
            const shared = sharingPrefs.get(cat.categoryId) ?? true;
            return (
              <div
                key={cat.categoryId}
                className={`flex items-center justify-between rounded-md border px-4 py-3 ${
                  shared ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="text-sm font-medium">{cat.categoryName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleSharing(cat.categoryId)}
                >
                  {shared ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">🔓 Shared</Badge>
                  ) : (
                    <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">🔒 Private</Badge>
                  )}
                </Button>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground pt-2">
            💡 Tip: Private categories still appear in your Personal view
          </p>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>Manage spending categories for your transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {DEFAULT_CATEGORIES.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-sm font-medium flex-1">{cat.name}</span>
                <span
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
              </div>
            ))}
            {customCategories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2 rounded-md border px-3 py-2">
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-sm font-medium flex-1">{cat.name}</span>
                <Badge variant="secondary" className={cat.sharedWithHousehold ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" : ""}>
                  {cat.sharedWithHousehold ? "🔓 Shared" : "🔒 Private"}
                </Badge>
                <span
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <button
                  onClick={() => handleEditCategory(cat)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Edit ${cat.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <Dialog
            open={categoryDialogOpen}
            onOpenChange={(open) => {
              setCategoryDialogOpen(open);
              if (!open) {
                setEditingCategory(null);
                setNewCategory({ name: "", emoji: "📌", color: "#6366f1", sharedWithHousehold: true });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" /> Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCategory ? "Edit Category" : "Add Custom Category"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="cat-name">Name</Label>
                  <Input
                    id="cat-name"
                    placeholder="e.g. Side Hustles"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-emoji">Emoji</Label>
                  <Input
                    id="cat-emoji"
                    placeholder="e.g. 💼"
                    value={newCategory.emoji}
                    onChange={(e) => setNewCategory((prev) => ({ ...prev, emoji: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-color">Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="cat-color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory((prev) => ({ ...prev, color: e.target.value }))}
                      className="h-9 w-12 cursor-pointer rounded border p-0.5"
                    />
                    <Input
                      placeholder="#6366f1"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory((prev) => ({ ...prev, color: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                {!editingCategory && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Share with household</p>
                      <p className="text-xs text-muted-foreground">Visible in the 🏠 Household view</p>
                    </div>
                    <Button
                      type="button"
                      variant={newCategory.sharedWithHousehold ? "default" : "outline"}
                      size="sm"
                      className={newCategory.sharedWithHousehold ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      onClick={() => setNewCategory((prev) => ({ ...prev, sharedWithHousehold: !prev.sharedWithHousehold }))}
                    >
                      {newCategory.sharedWithHousehold ? "🔓 Shared" : "🔒 Private"}
                    </Button>
                  </div>
                )}
                <Button onClick={handleAddCategory} className="w-full" disabled={!newCategory.name.trim()}>
                  {editingCategory ? "Save Changes" : "Add Category"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>Bank accounts linked via Plaid</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plaidItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts connected yet.</p>
          ) : (
            <div className="space-y-2">
              {plaidItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{item.institutionName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.accountIds.length} account{item.accountIds.length !== 1 ? "s" : ""}
                      {item.lastSynced && ` · Last synced: ${new Date(item.lastSynced).toLocaleString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveInstitution(item)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          <PlaidLinkButton onSuccess={() => window.location.reload()} />
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>Sync and manage your financial data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastSynced && (
            <p className="text-sm text-muted-foreground">Last synced: {lastSynced}</p>
          )}
          <Button onClick={handleSyncAll} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync All Transactions"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
