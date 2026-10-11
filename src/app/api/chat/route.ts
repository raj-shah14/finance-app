import OpenAI from "openai";
import { requireUser } from "@/lib/auth";
import { CHAT_TOOLS, runTool, type ChartSpec } from "@/lib/chat/tools";
import { loadUserAccounts, loadUserTransactions } from "@/lib/chat/load";
import { SPENDING_DEFINITION } from "@/lib/spending";

export const maxDuration = 120;

// Azure AI Foundry (Azure OpenAI) deployment. AZURE_OPENAI_DEPLOYMENT is the
// deployment name you chose, which is what the API calls "model".
const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const API_KEY = process.env.AZURE_OPENAI_API_KEY;
const DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const MAX_TOOL_ROUNDS = 8;
const MAX_HISTORY_MESSAGES = 30;

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string }
  | { type: "chart"; chart: ChartSpec }
  | { type: "error"; message: string };

function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the finance assistant inside the user's personal finance app. You answer questions about THEIR OWN accounts and transactions using the tools provided. Today's date is ${today}.

Rules:
- Every dollar figure you state must come from a tool result. Never estimate, extrapolate or do your own arithmetic across tool results beyond simple comparisons; if you need a number, call a tool for it.
- Resolve relative dates ("last month", "this year") to YYYY-MM-DD ranges from today's date before calling tools.
- ${SPENDING_DEFINITION} Credit card payments are not spending: card spending is purchases made on the card (use account_type "credit" or an account filter), and payments are reported separately as card_payments_made.
- If the data may be incomplete (history shorter than asked, or many uncategorized purchases), say so briefly.
- When a chart would help (trends, comparisons, shares), call render_chart with numbers from tool results, then summarize in a sentence or two. Don't chart a single number.
- This is read-only: you cannot change categories, accounts or any data. You are not a licensed financial advisor; give factual analysis rather than personalised investment advice.
- Answer concisely in plain text. No markdown headings, tables or bold; short "-" bullets are fine. Format money like $1,234.56.`;
}

export async function POST(req: Request) {
  if (process.env.USE_MOCK_DATA === "true") return mockResponse();

  if (!ENDPOINT || !API_KEY || !DEPLOYMENT) {
    return Response.json(
      { error: "Chat isn't configured: set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT." },
      { status: 503 }
    );
  }

  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { messages?: { role: string; content: string }[] } | null;
  const history = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content)
    .slice(-MAX_HISTORY_MESSAGES);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Send at least one user message." }, { status: 400 });
  }

  // Azure's OpenAI-compatible v1 endpoint: works for both
  // https://<resource>.openai.azure.com and the Foundry resource endpoint.
  const client = new OpenAI({ apiKey: API_KEY, baseURL: `${ENDPOINT.replace(/\/+$/, "")}/openai/v1/` });
  const tools: OpenAI.Chat.ChatCompletionTool[] = CHAT_TOOLS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));

      // Loaded lazily, once, so a plain "hello" costs no database work.
      let txns: ReturnType<typeof loadUserTransactions> | null = null;
      let accounts: ReturnType<typeof loadUserAccounts> | null = null;
      const ctx = {
        getTransactions: () => (txns ??= loadUserTransactions(userId)),
        getAccounts: () => (accounts ??= loadUserAccounts(userId)),
        onChart: (chart: ChartSpec) => send({ type: "chart", chart }),
      };

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt() },
        ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const s = await client.chat.completions.create({
            model: DEPLOYMENT,
            messages,
            tools,
            stream: true,
            max_completion_tokens: 8000,
          });

          let text = "";
          let finish: string | null = null;
          // Tool calls arrive as fragments keyed by index; stitch them together.
          const calls: { id: string; name: string; args: string }[] = [];
          for await (const chunk of s) {
            const choice = chunk.choices[0];
            if (!choice) continue;
            if (choice.delta.content) {
              text += choice.delta.content;
              send({ type: "text", text: choice.delta.content });
            }
            for (const tc of choice.delta.tool_calls ?? []) {
              const c = (calls[tc.index] ??= { id: "", name: "", args: "" });
              if (tc.id) c.id = tc.id;
              if (tc.function?.name) c.name += tc.function.name;
              if (tc.function?.arguments) c.args += tc.function.arguments;
            }
            if (choice.finish_reason) finish = choice.finish_reason;
          }

          if (finish === "length") {
            send({ type: "error", message: "The answer was cut off. Try asking for less at once." });
            break;
          }
          if (finish === "content_filter") {
            send({ type: "error", message: "The assistant couldn't answer that." });
            break;
          }
          const used = calls.filter(Boolean);
          if (used.length === 0) break;

          messages.push({
            role: "assistant",
            content: text || null,
            tool_calls: used.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args } })),
          });
          for (const c of used) {
            send({ type: "tool", name: c.name });
            let parsed: unknown;
            let output: { result: unknown; isError: boolean };
            try {
              parsed = c.args ? JSON.parse(c.args) : {};
              output = await runTool(c.name, parsed, ctx);
            } catch {
              output = { result: "Tool arguments were not valid JSON.", isError: true };
            }
            messages.push({
              role: "tool",
              tool_call_id: c.id,
              content: typeof output.result === "string" ? output.result : JSON.stringify(output.result),
            });
          }
          if (round === MAX_TOOL_ROUNDS - 1) {
            send({ type: "error", message: "That took too many steps. Try a narrower question." });
          }
        }
      } catch (e) {
        console.error("chat failed", e);
        const message =
          e instanceof OpenAI.RateLimitError
            ? "Rate limited — try again in a moment."
            : "Something went wrong answering that.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" } });
}

// Mock mode has no database or API key: stream a canned answer so the UI can
// be exercised end to end.
function mockResponse() {
  const encoder = new TextEncoder();
  const events: ChatEvent[] = [
    { type: "tool", name: "spending_summary" },
    { type: "text", text: "Here's a sample answer. Your top categories this year were Housing, Groceries and Dining Out:\n" },
    {
      type: "chart",
      chart: {
        type: "bar",
        title: "Spending by category (sample)",
        labels: ["Housing", "Groceries", "Dining Out", "Shopping"],
        series: [{ name: "Spent", values: [24600, 4630, 3480, 2100] }],
      },
    },
    { type: "text", text: "- Housing is the largest at $24,600.\n- Groceries and Dining Out together are about $8,100." },
  ];
  const stream = new ReadableStream({
    async start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        await new Promise((r) => setTimeout(r, 250));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson" } });
}
