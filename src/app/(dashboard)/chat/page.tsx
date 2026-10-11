"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatChart } from "@/components/chat/chat-chart";
import type { ChartSpec } from "@/lib/chat/tools";
import type { ChatEvent } from "@/lib/chat/run";

type Part = { kind: "text"; text: string } | { kind: "chart"; chart: ChartSpec };
interface Msg {
  role: "user" | "assistant";
  parts: Part[];
  error?: string;
}

const SUGGESTIONS = [
  "How much did I spend last month, and on what?",
  "Show my spending by category this year",
  "How much did I spend on my credit cards each month?",
  "What are my biggest transactions this month?",
];

const TOOL_LABELS: Record<string, string> = {
  spending_summary: "Crunching your spending…",
  list_transactions: "Looking through transactions…",
  list_accounts: "Checking your accounts…",
  render_chart: "Drawing a chart…",
};

const plainText = (m: Msg) =>
  m.parts.map((p) => (p.kind === "text" ? p.text : "")).join("").trim();

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setStatus("Thinking…");

    const next: Msg[] = [...messages, { role: "user", parts: [{ kind: "text", text: q }] }];
    setMessages([...next, { role: "assistant", parts: [] }]);

    // Update the in-flight assistant message (always the last one).
    const patch = (fn: (m: Msg) => Msg) =>
      setMessages((cur) => [...cur.slice(0, -1), fn(cur[cur.length - 1])]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only the text of earlier turns goes back; charts are display-only.
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: plainText(m) })).filter((m) => m.content) }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        patch((m) => ({ ...m, error: err?.error ?? "Couldn't reach the assistant." }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      const handle = (e: ChatEvent) => {
        if (e.type === "text") {
          setStatus(null);
          patch((m) => {
            const last = m.parts[m.parts.length - 1];
            const parts =
              last?.kind === "text"
                ? [...m.parts.slice(0, -1), { kind: "text" as const, text: last.text + e.text }]
                : [...m.parts, { kind: "text" as const, text: e.text }];
            return { ...m, parts };
          });
        } else if (e.type === "tool") {
          setStatus(TOOL_LABELS[e.name] ?? "Working…");
        } else if (e.type === "chart") {
          patch((m) => ({ ...m, parts: [...m.parts, { kind: "chart", chart: e.chart }] }));
        } else {
          patch((m) => ({ ...m, error: e.message }));
        }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) handle(JSON.parse(line) as ChatEvent);
        }
      }
    } catch {
      patch((m) => ({ ...m, error: "Connection lost. Try again." }));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Ask about your money</h1>
          <p className="text-xs text-muted-foreground">Your own accounts only. Read-only — it can&apos;t change anything.</p>
        </div>
      </div>

      <div className="space-y-4 pb-24">
        {messages.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-xl border bg-card p-3 text-left text-sm transition-colors hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                {plainText(m)}
              </div>
            </div>
          ) : (
            <div key={i} className="max-w-full space-y-3 rounded-2xl rounded-bl-sm border bg-card p-4">
              {m.parts.map((p, j) =>
                p.kind === "text" ? (
                  <p key={j} className="whitespace-pre-wrap text-sm leading-relaxed">{p.text}</p>
                ) : (
                  <ChatChart key={j} spec={p.chart} />
                )
              )}
              {m.error && <p className="text-sm text-destructive">{m.error}</p>}
            </div>
          )
        )}

        {status && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
          </p>
        )}
        <div ref={endRef} />
      </div>

      {/* Fixed to the viewport (not sticky): the dashboard layout's overflow-x-hidden
          wrapper makes sticky bind to it instead of the window, which left the
          box sitting under the bottom tab bar. Offsets come from the shared
          mobile-chrome variables; the sidebar is 16rem wide on desktop. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="fixed inset-x-0 bottom-[calc(var(--mobile-bottom-nav-h)+var(--mobile-bottom-nav-bottom-pad))] z-30 bg-background/95 backdrop-blur md:bottom-0 md:left-64"
      >
        <div className="mx-auto flex max-w-3xl gap-2 px-4 py-2 md:px-8 md:py-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about spending, cards, income…"
            disabled={busy}
            className="h-11 min-w-0 flex-1 rounded-full border bg-card px-4 text-base outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} className="h-11 w-11 shrink-0 rounded-full" aria-label="Send">
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
