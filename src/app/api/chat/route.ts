import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { CHAT_TOOLS, runTool, type ChartSpec } from "@/lib/chat/tools";
import { loadUserAccounts, loadUserTransactions } from "@/lib/chat/load";
import { SPENDING_DEFINITION } from "@/lib/spending";

export const maxDuration = 120;

// Override with CHAT_MODEL to trade capability for cost.
const MODEL = process.env.CHAT_MODEL || "claude-opus-5-5";
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Chat isn't configured: ANTHROPIC_API_KEY is not set." }, { status: 503 });
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

  const client = new Anthropic();
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

      const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const s = client.beta.messages.stream({
            model: MODEL,
            max_tokens: 16000,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            thinking: { type: "adaptive" },
            output_config: { effort: "medium" },
            system: systemPrompt(),
            tools: CHAT_TOOLS,
            messages,
          } as Anthropic.Beta.MessageCreateParamsStreaming);
          s.on("text", (text) => send({ type: "text", text }));
          const msg = await s.finalMessage();

          if (msg.stop_reason === "refusal") {
            send({ type: "error", message: "The assistant declined to answer that." });
            break;
          }
          if (msg.stop_reason === "max_tokens") {
            send({ type: "error", message: "The answer was cut off. Try asking for less at once." });
            break;
          }
          if (msg.stop_reason !== "tool_use") break;

          // Echo the whole assistant turn back unchanged (thinking blocks included).
          messages.push({ role: "assistant", content: msg.content });
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          for (const block of msg.content) {
            if (block.type !== "tool_use") continue;
            send({ type: "tool", name: block.name });
            const { result, isError } = await runTool(block.name, block.input, ctx);
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: typeof result === "string" ? result : JSON.stringify(result),
              is_error: isError || undefined,
            });
          }
          messages.push({ role: "user", content: results });
          if (round === MAX_TOOL_ROUNDS - 1) {
            send({ type: "error", message: "That took too many steps. Try a narrower question." });
          }
        }
      } catch (e) {
        console.error("chat failed", e);
        const message =
          e instanceof Anthropic.RateLimitError
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
