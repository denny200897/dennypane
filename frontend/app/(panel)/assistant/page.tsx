"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Send, Loader2, User } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "目前伺服器的 CPU 和記憶體狀況如何？",
  "磁碟空間還夠用嗎？",
  "有哪些容器正在執行？",
  "幫我看看目前最吃資源的程序。",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .assistantStatus()
      .then((s) => setEnabled(s.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const { reply } = await api.assistantChat(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e: any) {
      toast.error(e.message);
      setMessages(next); // keep the user's message; let them retry
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="size-6 text-primary" /> AI 助手
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          用自然語言詢問伺服器狀況，助手會根據即時指標回答。
        </p>
      </div>

      {enabled === false && (
        <Card className="mb-4 border-amber-500/40">
          <CardContent className="py-4 text-sm text-muted-foreground">
            AI 助手尚未設定。請在 <code className="text-foreground">.env</code> 填入{" "}
            <code className="text-foreground">DENNY_ASSISTANT_BASE_URL</code> 與{" "}
            <code className="text-foreground">DENNY_ASSISTANT_API_KEY</code> 後重啟服務。
          </CardContent>
        </Card>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 rounded-xl border bg-card/40 p-4"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5 text-muted-foreground">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="size-7" />
            </div>
            <p className="max-w-sm text-sm">問我關於這台伺服器的任何狀況，例如：</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={enabled === false}
                  className="rounded-full border px-3 py-1.5 text-xs hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "flex justify-end" : "flex gap-3"}
          >
            {m.role === "assistant" && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="size-4" />
              </div>
            )}
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap"
                  : "max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm whitespace-pre-wrap"
              }
            >
              {m.content}
            </div>
            {m.role === "user" && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted ml-3">
                <User className="size-4" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="size-4" />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入訊息…"
          disabled={sending || enabled === false}
          autoFocus
        />
        <Button type="submit" disabled={sending || !input.trim() || enabled === false}>
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
