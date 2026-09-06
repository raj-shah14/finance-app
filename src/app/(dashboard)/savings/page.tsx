"use client";

import { HoldingsView } from "@/components/holdings/holdings-view";

export default function SavingsPage() {
  return (
    <HoldingsView
      title="Savings"
      description="Savings deposits (HYSA, money market) across all linked accounts"
      accountFilter={(a) => a.type === "depository" && a.subtype === "savings"}
      accountTypeLabel="Savings"
      emptyLabel="No savings accounts linked"
    />
  );
}
