import { requireUser } from "@/lib/auth";
import { loadUserAccounts, loadUserTransactions } from "@/lib/chat/load";
import { runChat, type ChatEvent } from "@/lib/chat/run";

export const maxDuration = 120;

const MAX_HISTORY_MESSAGES = 30;

export async function POST(req: Request) {
  if (process.env.USE_MOCK_DATA === "true") return mockResponse();

  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!endpoint || !apiKey || !deployment) {
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
    .slice(-MAX_HISTORY_MESSAGES) as { role: "user" | "assistant"; content: string }[];
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return Response.json({ error: "Send at least one user message." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      // Loaded lazily, once, so a plain "hello" costs no database work.
      let txns: ReturnType<typeof loadUserTransactions> | null = null;
      let accounts: ReturnType<typeof loadUserAccounts> | null = null;
      try {
        await runChat(
          { endpoint, apiKey, deployment },
          history,
          {
            getTransactions: () => (txns ??= loadUserTransactions(userId)),
            getAccounts: () => (accounts ??= loadUserAccounts(userId)),
          },
          send
        );
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
