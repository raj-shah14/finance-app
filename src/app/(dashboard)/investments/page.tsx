"use client";

import { HoldingsView } from "@/components/holdings/holdings-view";

export default function InvestmentsPage() {
  return (
    <HoldingsView
      title="Investments"
      description="Brokerage, retirement, and crypto accounts across all linked institutions"
      accountFilter={(a) => a.type === "investment"}
      accountTypeLabel="Investment"
      emptyLabel="No investment accounts linked"
    />
  );
}
