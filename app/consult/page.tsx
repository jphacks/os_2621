"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HeartHandshake, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Disclaimer } from "@/components/disclaimer";
import { isBlocked, readChatStream } from "@/components/consult/stream";
import { sessionStore, type ChatMessage } from "@/components/session-store";
import { COPY } from "@/lib/copy";

const MAX_TURNS = 20; // サーバーに送る直近の往復数（SPEC §5.2）

// P3 AI相談（会話はsessionStorageのみ。DBには保存しない）
export default function ConsultPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [matchingBlocked, setMatchingBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(sessionStore.getMessages());
    const flags = sessionStore.getFlags();
    setCrisis(flags.crisis);
    setMatchingBlocked(flags.matchingBlocked);
    setReady(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, crisis]);

  function applyFlags(next: { crisis?: boolean; matchingBlocked?: boolean }) {
    const flags = { ...sessionStore.getFlags(), ...next };
    sessionStore.setFlags(flags);
    setCrisis(flags.crisis);
    setMatchingBlocked(flags.matchingBlocked);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || crisis) return;
    setInput("");
    setError(null);
    setBusy(true);

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    sessionStore.setMessages(history);

    let reply = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-MAX_TURNS * 2),
          checkin: sessionStore.getCheckin(),
        }),
      });
      if (!res.ok) throw new Error("chat failed");

      for await (const ev of readChatStream(res)) {
        // blocked / matchingBlocked は、どのイベントに付いていても「話を整理する」を無効にする
        if (isBlocked(ev)) applyFlags({ matchingBlocked: true });
        if (ev.type === "crisis") {
          // 通常の応答は出さず、危機対応に切り替える
          reply = "";
          applyFlags({ crisis: true });
          break;
        }
        if (ev.type === "delta") {
          reply += ev.text;
          setMessages([...history, { role: "assistant", content: reply }]);
        }
      }
    } catch {
      // 応答の取得に失敗したら安全側に倒し、このセッションのマッチングは止める
      setError(COPY.generalError);
      applyFlags({ matchingBlocked: true });
    }

    // 返事が1文字も届かなかったとき（Gemini側の混雑など）は、やさしく知らせる
    if (!reply && !sessionStore.getFlags().crisis) setError(COPY.generalError);

    const finalMessages = reply ? [...history, { role: "assistant" as const, content: reply }] : history;
    setMessages(finalMessages);
    sessionStore.setMessages(finalMessages);
    setBusy(false);
  }

  function restart() {
    sessionStore.clearConsult();
    setMessages([]);
    setCrisis(false);
    setMatchingBlocked(false);
    setError(null);
  }

  const canOrganize = !crisis && !matchingBlocked && messages.some((m) => m.role === "user") && !busy;

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-3">
      <Disclaimer />

      <div className="flex-1 space-y-3" aria-live="polite">
        {ready && messages.length === 0 && !crisis && (
          <p className="py-10 text-center text-sm text-muted-foreground">{COPY.consult.empty}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card"
              }`}
            >
              {m.content || (busy && i === messages.length - 1 ? COPY.consult.thinking : "")}
            </div>
          </div>
        ))}

        {crisis && (
          <div role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-card p-4 text-sm">
            <p className="font-medium">{COPY.consult.crisisTitle}</p>
            <p className="leading-relaxed text-muted-foreground">{COPY.consult.crisisBody}</p>
            <Button asChild variant="destructive">
              <Link href="/crisis">
                <HeartHandshake className="h-4 w-4" aria-hidden="true" />
                {COPY.consult.crisisButton}
              </Link>
            </Button>
          </div>
        )}

        {!crisis && matchingBlocked && (
          <div role="status" className="space-y-2 rounded-lg border bg-secondary/40 px-4 py-2 text-xs text-muted-foreground">
            <p>{COPY.consult.matchingBlocked}</p>
            {/* 画面の状態だけを新しくする。サーバーの止める記録は、時間がたつと自然に外れる */}
            <Button variant="outline" size="sm" onClick={restart}>
              {COPY.consult.newSession}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-center text-xs text-muted-foreground">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 space-y-2 border-t bg-background pb-2 pt-3">
        {crisis ? (
          <Button variant="outline" onClick={restart}>
            {COPY.consult.newSession}
          </Button>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                rows={2}
                maxLength={1000}
                placeholder={COPY.consult.placeholder}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // IME変換中のEnterでは送信しない
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                disabled={busy}
                aria-label="相談の内容"
              />
              <Button onClick={() => void send()} disabled={busy || !input.trim()} aria-label={COPY.consult.send}>
                <Send className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{COPY.consult.send}</span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canOrganize ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href="/summary">{COPY.consult.organize}</Link>
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  {COPY.consult.organize}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{COPY.consult.organizeHint}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
