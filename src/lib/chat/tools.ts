/**
 * Tool definitions the chat model can call, and the dispatcher that runs
 * them. All tools are read-only: nothing here can create, edit or delete
 * data. Dispatch is separated from the API route so it can be tested.
 */
import type Anthropic from "@anthropic-ai/sdk";
import {
  listAccounts,
  listTransactions,
  spendingSummary,
  type ChatAccount,
  type ChatTxn,
  type ListTransactionsInput,
  type SpendingSummaryInput,
} from "./queries";

export interface ChartSpec {
  type: "bar" | "line" | "pie";
  title: string;
  labels: string[];
  series: { name: string; values: number[] }[];
  /** "currency" (default) or "number". */
  unit?: "currency" | "number";
}

const filterProps = {
  start_date: { type: "string", description: "Inclusive start, YYYY-MM-DD." },
  end_date: { type: "string", description: "Inclusive end, YYYY-MM-DD." },
  category: { type: "string", description: "Exact category name, e.g. 'Groceries'." },
  account: {
    type: "string",
    description: "Account name substring or last-4 mask, e.g. 'Amex' or '1234'.",
  },
  account_type: {
    type: "string",
    enum: ["credit", "depository", "loan", "investment"],
    description: "Use 'credit' for credit-card activity.",
  },
  search: { type: "string", description: "Matches merchant or description text." },
} as const;

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "spending_summary",
    description:
      "Totals and a breakdown for the user's own transactions in a date range, using the app's shared spending definition (transfers and card payments are excluded from spending, refunds are netted). Use this for any 'how much did I spend/earn' question and as the data source for charts. Also returns card_purchases and card_payments_made for the filtered rows.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        ...filterProps,
        group_by: {
          type: "string",
          enum: ["category", "month", "merchant", "account", "day"],
          description: "How to break the spending down. Default category.",
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "list_transactions",
    description:
      "Individual transactions matching filters. Amounts: positive = money out, negative = money in. 'counted_as' says whether the app treats it as spending, income, a transfer, or excluded. Max 50 rows.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        ...filterProps,
        min_amount: { type: "number", description: "Minimum absolute amount." },
        max_amount: { type: "number", description: "Maximum absolute amount." },
        sort: { type: "string", enum: ["date", "amount"], description: "Default date (newest first)." },
        limit: { type: "integer", description: "Rows to return, default 20, max 50." },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "list_accounts",
    description: "The user's linked accounts with type and current balance.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "render_chart",
    description:
      "Show a chart to the user. Only plot numbers returned by the other tools - never estimate or compute new figures. Use 'line' for trends over time, 'bar' for comparisons, 'pie' for shares of a whole (one series, <= 8 slices).",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["bar", "line", "pie"] },
        title: { type: "string" },
        labels: { type: "array", items: { type: "string" }, description: "X-axis labels / slice names." },
        series: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              values: { type: "array", items: { type: "number" }, description: "One value per label." },
            },
            required: ["name", "values"],
            additionalProperties: false,
          },
        },
        unit: { type: "string", enum: ["currency", "number"], description: "Default currency (USD)." },
      },
      required: ["type", "title", "labels", "series"],
      additionalProperties: false,
    },
  },
];

export interface ToolContext {
  getTransactions: () => Promise<ChatTxn[]>;
  getAccounts: () => Promise<ChatAccount[]>;
  onChart: (chart: ChartSpec) => void;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateChart(input: unknown): ChartSpec | string {
  const c = input as Partial<ChartSpec> | null;
  if (!c || !Array.isArray(c.labels) || !Array.isArray(c.series) || c.series.length === 0) {
    return "Chart needs labels and at least one series.";
  }
  if (c.type !== "bar" && c.type !== "line" && c.type !== "pie") return "Unknown chart type.";
  if (c.labels.length === 0 || c.labels.length > 60) return "Use between 1 and 60 labels.";
  for (const s of c.series) {
    if (!Array.isArray(s.values) || s.values.length !== c.labels.length || s.values.some((v) => !Number.isFinite(v))) {
      return `Series "${s?.name}" must have exactly one finite number per label.`;
    }
  }
  if (c.type === "pie" && c.series.length !== 1) return "Pie charts take exactly one series.";
  return {
    type: c.type,
    title: String(c.title ?? ""),
    labels: c.labels.map(String),
    series: c.series.map((s) => ({ name: String(s.name), values: s.values })),
    unit: c.unit === "number" ? "number" : "currency",
  };
}

/** Run one tool call. Returns the JSON-able result and whether it failed. */
export async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext
): Promise<{ result: unknown; isError: boolean }> {
  try {
    const args = (input ?? {}) as Record<string, unknown>;
    for (const k of ["start_date", "end_date"]) {
      const v = args[k];
      if (v !== undefined && !(typeof v === "string" && DATE_RE.test(v))) {
        return { result: `${k} must be YYYY-MM-DD.`, isError: true };
      }
    }
    switch (name) {
      case "spending_summary":
        return { result: spendingSummary(await ctx.getTransactions(), args as SpendingSummaryInput), isError: false };
      case "list_transactions":
        return { result: listTransactions(await ctx.getTransactions(), args as ListTransactionsInput), isError: false };
      case "list_accounts":
        return { result: listAccounts(await ctx.getAccounts()), isError: false };
      case "render_chart": {
        const chart = validateChart(input);
        if (typeof chart === "string") return { result: chart, isError: true };
        ctx.onChart(chart);
        return { result: "Chart displayed to the user.", isError: false };
      }
      default:
        return { result: `Unknown tool ${name}.`, isError: true };
    }
  } catch (e) {
    console.error(`chat tool ${name} failed`, e);
    return { result: "The tool failed unexpectedly.", isError: true };
  }
}
