import OpenAI from "openai";
import { CHAT_TOOLS, runTool, type ChartSpec, type ToolContext } from "./tools";
import { SPENDING_DEFINITION } from "@/lib/spending";

const MAX_TOOL_ROUNDS = 8;

export type ChatEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string }
  | { type: "chart"; chart: ChartSpec }
  | { type: "error"; message: string };

export function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the finance assistant inside the user's personal finance app. You answer questions about THEIR OWN accounts and transactions using the tools provided. Today's date is ${today}.

Rules:
- Every dollar figure you state must come from a tool result. Never estimate, extrapolate or do your own arithmetic across tool results beyond simple comparisons; if you need a number, call a tool for it.
- Resolve relative dates ("last month", "this year") to YYYY-MM-DD ranges from today's date before calling tools.
- ${SPENDING_DEFINITION} Credit card payments are not spending: card spending is purchases made on the card (use account_type "credit" or an account filter), and payments are reported separately as card_payments_made.
- If the data may be incomplete (history shorter than asked, or many uncategorized purchases), say so briefly.
- Charts are shown inside the same tile as your written answer, so include one by default whenever the answer has a breakdown, comparison or trend of 3 or more data points (by category, month, merchant, card, etc.): call render_chart with numbers from tool results, then add a short written summary of the key takeaway. Skip the chart only for a single number or a plain list of transactions.
- This is read-only: you cannot change categories, accounts or any data. You are not a licensed financial advisor; give factual analysis rather than personalised investment advice.
- Answer concisely in plain text. No markdown headings, tables or bold; short "-" bullets are fine. Format money like $1,234.56.`;
}


export interface ChatConfig {
  endpoint: string;
  apiKey: string;
  /** Deployment name — what the API calls "model". */
  deployment: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * One assistant answer: stream the model, run any tool calls it makes, feed
 * the results back, repeat until it answers. Events go out through `send`.
 */
export async function runChat(
  cfg: ChatConfig,
  history: ChatTurn[],
  ctx: Omit<ToolContext, "onChart">,
  send: (e: ChatEvent) => void
): Promise<void> {
  // Azure's OpenAI-compatible v1 endpoint. Accepts the bare resource URL
  // (https://<resource>.openai.azure.com or .services.ai.azure.com) or a full
  // URL copied from the portal (…/openai/v1/responses): only the origin is used.
  const client = new OpenAI({ apiKey: cfg.apiKey, baseURL: `${new URL(cfg.endpoint).origin}/openai/v1/` });
  const tools: OpenAI.Chat.ChatCompletionTool[] = CHAT_TOOLS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const toolCtx: ToolContext = { ...ctx, onChart: (chart: ChartSpec) => send({ type: "chart", chart }) };
  const model = cfg.deployment;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt() },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const s = await client.chat.completions.create({
        model,
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
          output = await runTool(c.name, parsed, toolCtx);
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
  }
}
