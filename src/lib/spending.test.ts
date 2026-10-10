import { describe, expect, it } from "vitest";
import {
  PLAID_CARD_PAYMENT_CODE,
  cardPaymentAmount,
  cardPurchaseAmount,
  classifyTransaction,
  incomeAmount,
  isCardPayment,
  isCardPaymentSource,
  totalCardPayments,
  totalCardPurchases,
  monthKey,
  spendingAmount,
  spendingBy,
  summarize,
  totalIncome,
  totalSpending,
  type ClassifiableTransaction,
} from "@/lib/spending";
import { EXCLUDED_FROM_SPENDING } from "@/lib/categories";

const tx = (amount: number, categoryName: string | null): ClassifiableTransaction => ({
  amount,
  categoryName,
});

describe("classifyTransaction", () => {
  it("treats an ordinary category as spending", () => {
    expect(classifyTransaction(tx(50, "Groceries"))).toEqual({ kind: "spending", uncategorized: false });
  });

  it.each(["Transfers", "CC Bill", "CC Payment", "CC Payments"])("treats %s as a transfer in both directions", (name) => {
    expect(classifyTransaction(tx(900, name)).kind).toBe("transfer");
    expect(classifyTransaction(tx(-900, name)).kind).toBe("transfer");
  });

  it("counts deposits in income categories as income", () => {
    expect(classifyTransaction(tx(-5000, "Income")).kind).toBe("income");
    expect(classifyTransaction(tx(-500, "Savings & Investments")).kind).toBe("income");
  });

  it("leaves the outflow side of an income category out of spending", () => {
    // Money moved into savings is neither spending nor income.
    expect(classifyTransaction(tx(500, "Savings & Investments")).kind).toBe("excluded");
  });

  it("counts uncategorized purchases as spending, flagged", () => {
    expect(classifyTransaction(tx(25, null))).toEqual({ kind: "spending", uncategorized: true });
  });

  it("does not net an uncategorized deposit against spending", () => {
    // A paycheck that never got a category must not wipe out spending.
    expect(classifyTransaction(tx(-4000, null))).toEqual({ kind: "excluded", uncategorized: true });
    expect(spendingAmount(tx(-4000, null))).toBe(0);
  });

  it("lets an explicit category kind win over the name", () => {
    expect(classifyTransaction({ amount: 80, categoryName: "Groceries", categoryKind: "transfer" }).kind).toBe("transfer");
    expect(classifyTransaction({ amount: 80, categoryName: "CC Bill", categoryKind: "spending" }).kind).toBe("spending");
    expect(classifyTransaction({ amount: -10, categoryName: null, categoryKind: "income" }).kind).toBe("income");
  });
});

describe("netting refunds", () => {
  it("subtracts a refund from the spending it reverses", () => {
    const txns = [tx(100, "Groceries"), tx(-20, "Groceries")];
    expect(totalSpending(txns)).toBe(80);
    expect(summarize(txns).refunds).toBe(20);
  });

  it("nets a refund that landed in a different spending category", () => {
    expect(totalSpending([tx(100, "Shopping"), tx(-30, "Gifts")])).toBe(70);
  });
});

describe("credit cards: nothing is counted twice", () => {
  it("counts the card purchase once, not the payments that settle it", () => {
    const txns = [
      tx(200, "Shopping"), // purchase on the card
      tx(200, "CC Bill"), // payment out of checking
      tx(-200, "CC Bill"), // the same payment arriving on the card
    ];
    expect(totalSpending(txns)).toBe(200);
    expect(summarize(txns).transferCount).toBe(2);
  });

  it("holds when card payments are categorized as plain Transfers", () => {
    expect(totalSpending([tx(200, "Shopping"), tx(200, "Transfers"), tx(-200, "Transfers")])).toBe(200);
  });
});

describe("income", () => {
  it("sums deposits in income categories only", () => {
    const txns = [tx(-5000, "Income"), tx(-250, "Savings & Investments"), tx(-40, "Groceries"), tx(-100, null)];
    expect(totalIncome(txns)).toBe(5250);
    expect(incomeAmount(tx(-40, "Groceries"))).toBe(0);
  });

  it("never reduces spending", () => {
    expect(totalSpending([tx(60, "Dining Out"), tx(-5000, "Income")])).toBe(60);
  });
});

describe("summarize", () => {
  it("reports what was included and what was set aside", () => {
    const s = summarize([
      tx(100, "Groceries"),
      tx(-20, "Groceries"),
      tx(35, null),
      tx(-4000, null),
      tx(-5000, "Income"),
      tx(900, "CC Bill"),
    ]);
    expect(s).toEqual({
      spending: 115,
      income: 5000,
      refunds: 20,
      uncategorizedCount: 1,
      uncategorizedAmount: 35,
      uncategorizedInflowCount: 1,
      uncategorizedInflowAmount: 4000,
      transferCount: 1,
    });
  });
});

describe("spendingBy", () => {
  it("groups net spending and ignores non-spending rows", () => {
    const txns = [
      { ...tx(100, "Groceries"), month: "2026-03" },
      { ...tx(-20, "Groceries"), month: "2026-03" },
      { ...tx(50, "Dining Out"), month: "2026-04" },
      { ...tx(900, "CC Bill"), month: "2026-03" },
      { ...tx(-5000, "Income"), month: "2026-03" },
    ];
    const byMonth = spendingBy(txns, (t) => t.month);
    expect([...byMonth.entries()]).toEqual([
      ["2026-03", { amount: 80, count: 2 }],
      ["2026-04", { amount: 50, count: 1 }],
    ]);
  });
});

describe("monthKey", () => {
  it("buckets by UTC calendar month", () => {
    // Plaid dates are UTC midnight; the 1st must stay in its own month.
    expect(monthKey("2026-03-01T00:00:00.000Z")).toBe("2026-03");
    expect(monthKey(new Date("2026-03-01T00:00:00.000Z"))).toBe("2026-03");
    expect(monthKey("2026-02-28T00:00:00.000Z")).toBe("2026-02");
  });
});

describe("agreement with the pre-existing /api/insights formula", () => {
  // /api/insights sums every amount per category and keeps the categories
  // that aren't excluded. On data with no uncategorized deposits, the shared
  // definition must produce the same total — this pins the two together
  // until the route is migrated to call the module directly.
  it("matches a per-category net over non-excluded categories", () => {
    const txns = [
      tx(120, "Housing"),
      tx(80, "Groceries"),
      tx(-15, "Groceries"),
      tx(40, null),
      tx(500, "Savings & Investments"),
      tx(-500, "Savings & Investments"),
      tx(-4200, "Income"),
      tx(300, "CC Bill"),
      tx(-300, "CC Bill"),
      tx(65, "Transfers"),
    ];

    const byCategory = new Map<string, number>();
    for (const t of txns) {
      const name = t.categoryName ?? "Uncategorized";
      byCategory.set(name, (byCategory.get(name) ?? 0) + t.amount);
    }
    const legacy = [...byCategory.entries()]
      .filter(([name]) => !EXCLUDED_FROM_SPENDING.includes(name))
      .reduce((sum, [, amount]) => sum + amount, 0);

    expect(totalSpending(txns)).toBe(legacy);
  });
});

describe("credit card payments (CC Bill / CC Payment)", () => {
  const checking = (amount: number, categoryName: string | null, plaidCategory?: string): ClassifiableTransaction => ({
    amount, categoryName, plaidCategory, accountType: "depository",
  });
  const card = (amount: number, categoryName: string | null, plaidCategory?: string): ClassifiableTransaction => ({
    amount, categoryName, plaidCategory, accountType: "credit",
  });

  it("counts a payment on the card side, by CC category name", () => {
    expect(isCardPayment(card(-900, "CC Payment"))).toBe(true);
    expect(isCardPayment(card(-900, "CC Bill"))).toBe(true);
    expect(cardPaymentAmount(card(-900, "CC Payment"))).toBe(900);
  });

  it("counts one Plaid flagged as a card payment even when categorized Transfers", () => {
    // New syncs land here since the Plaid code was mapped to Transfers.
    expect(isCardPayment(card(-900, "Transfers", PLAID_CARD_PAYMENT_CODE))).toBe(true);
  });

  it("counts an old, never-categorized card payment — and keeps it out of spending", () => {
    // Synced before the Plaid code was mapped: no category at all.
    const old = card(-900, null, PLAID_CARD_PAYMENT_CODE);
    expect(isCardPayment(old)).toBe(true);
    expect(totalSpending([old])).toBe(0);
    // The checking-side twin with no category is also not spending.
    expect(classifyTransaction(checking(900, null, PLAID_CARD_PAYMENT_CODE)).kind).toBe("transfer");
  });

  it("does not treat an ordinary transfer onto a card as a payment", () => {
    expect(isCardPayment(card(-500, "Transfers"))).toBe(false);
  });

  it("counts a payment once even though both sides exist", () => {
    const both = [checking(900, "CC Bill"), card(-900, "CC Payment")];
    expect(totalCardPayments(both)).toBe(900);
    expect(isCardPayment(checking(900, "CC Bill"))).toBe(false);
    expect(isCardPaymentSource(checking(900, "CC Bill"))).toBe(true);
  });

  it("still counts a payment made from an account that isn't linked", () => {
    // Only the card side exists — e.g. a card autopaid from another bank.
    expect(totalCardPayments([card(-2153.01, "CC Payment")])).toBe(2153.01);
  });

  it("does not count a merchant refund onto a card as a payment", () => {
    expect(isCardPayment(card(-40, "Shopping"))).toBe(false);
    expect(spendingAmount(card(-40, "Shopping"))).toBe(-40); // netted as a refund
  });

  it("does not count a payment the user recategorized as spending", () => {
    const t = card(-120, "Groceries", PLAID_CARD_PAYMENT_CODE);
    expect(isCardPayment(t)).toBe(false);
  });

  it("only counts deposits on the card", () => {
    expect(cardPaymentAmount(card(75, "CC Payment"))).toBe(0); // a charge, not a payment
  });

  it("measures card purchases separately from payments, netting card refunds", () => {
    const txns = [
      card(300, "Shopping"),
      card(-50, "Shopping"), // refund onto the card
      card(-250, "CC Payment"), // payment onto the card
      checking(250, "CC Bill"), // the same payment leaving checking
      checking(80, "Groceries"), // debit-card purchase: not a card purchase
    ];
    expect(totalCardPurchases(txns)).toBe(250);
    expect(totalCardPayments(txns)).toBe(250);
    expect(cardPurchaseAmount(checking(80, "Groceries"))).toBe(0);
  });
});
