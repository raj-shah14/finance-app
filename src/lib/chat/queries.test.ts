import { describe, expect, it } from "vitest";
import { listTransactions, spendingSummary, type ChatTxn } from "./queries";
import { runTool } from "./tools";

const t = (o: Partial<ChatTxn> & { date: string; amount: number }): ChatTxn => ({
  name: "x",
  merchant: null,
  categoryName: "Groceries",
  accountName: "Checking",
  accountMask: "1111",
  accountType: "depository",
  pending: false,
  ...o,
});

const card = { accountName: "Amex", accountMask: "9999", accountType: "credit" };

const txns: ChatTxn[] = [
  t({ date: "2026-09-02", amount: 100, merchant: "Whole Foods", ...card }),
  t({ date: "2026-09-10", amount: -20, merchant: "Whole Foods", ...card }), // refund nets
  t({ date: "2026-09-12", amount: 50, categoryName: "Dining Out", merchant: "Chipotle", ...card }),
  t({ date: "2026-09-15", amount: -300, categoryName: "CC Payment", name: "payment", ...card }), // card payment
  t({ date: "2026-09-15", amount: 300, categoryName: "CC Bill", name: "payment out" }), // checking side
  t({ date: "2026-09-20", amount: -5000, categoryName: "Income", name: "payroll" }),
  t({ date: "2026-10-01", amount: 70, categoryName: "Dining Out", merchant: "Chipotle" }),
];

describe("spendingSummary", () => {
  it("applies the shared definition: nets refunds, excludes transfers", () => {
    const r = spendingSummary(txns, { start_date: "2026-09-01", end_date: "2026-09-30" });
    expect(r.total_spending).toBe(130); // 100 - 20 + 50
    expect(r.total_income).toBe(5000);
    expect(r.card_payments_made).toBe(300);
    expect(r.groups.map((g) => g.key)).toEqual(["Groceries", "Dining Out"]);
  });

  it("filters to a card via account_type and account", () => {
    const r = spendingSummary(txns, { account: "amex" });
    expect(r.card_purchases).toBe(130);
    expect(spendingSummary(txns, { account_type: "credit" }).total_spending).toBe(130);
    expect(spendingSummary(txns, { account: "9999" }).total_spending).toBe(130);
  });

  it("groups by month in calendar order", () => {
    const r = spendingSummary(txns, { group_by: "month" });
    expect(r.groups.map((g) => g.key)).toEqual(["2026-09", "2026-10"]);
    expect(r.groups[1].amount).toBe(70);
  });
});

describe("listTransactions", () => {
  it("sorts by size, bounds by absolute amount, labels how each is counted", () => {
    const r = listTransactions(txns, { sort: "amount", min_amount: 100, limit: 3 });
    expect(r.transactions.map((x) => x.amount)).toEqual([-5000, -300, 300]);
    expect(r.transactions.find((x) => x.amount === 300)?.counted_as).toBe("transfer");
  });
});

describe("runTool", () => {
  const ctx = (charts: unknown[] = []) => ({
    getTransactions: async () => txns,
    getAccounts: async () => [],
    onChart: (c: unknown) => charts.push(c),
  });

  it("rejects malformed dates and unknown tools without throwing", async () => {
    expect((await runTool("spending_summary", { start_date: "last month" }, ctx())).isError).toBe(true);
    expect((await runTool("delete_everything", {}, ctx())).isError).toBe(true);
  });

  it("only emits charts whose series line up with their labels", async () => {
    const charts: unknown[] = [];
    const bad = await runTool("render_chart", { type: "bar", title: "t", labels: ["a", "b"], series: [{ name: "s", values: [1] }] }, ctx(charts));
    expect(bad.isError).toBe(true);
    const ok = await runTool("render_chart", { type: "bar", title: "t", labels: ["a"], series: [{ name: "s", values: [1] }] }, ctx(charts));
    expect(ok.isError).toBe(false);
    expect(charts).toHaveLength(1);
  });
});
