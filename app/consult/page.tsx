"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Heart, HeartHandshake, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Disclaimer } from "@/components/disclaimer";
import { isBlocked, readChatStream } from "@/components/consult/stream";
import { BreathingIndicator } from "@/components/breathing-indicator";
import { BreatheGuide } from "@/components/breathe-guide";
import { HotlineList } from "@/components/hotline-list";
import { sessionStore, type ChatMessage } from "@/components/session-store";
import { COPY } from "@/lib/copy";

const MAX_TURNS = 20; // サーバーに送る直近の往復数（SPEC §5.2）

// P3 AI相談（会話はsessionStorageのみ。DBには保存しない）
// 危機検知時もチャットを機械的に打ち切らず、寄り添い対話と相談窓口カードを両立する
export default function ConsultPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [matchingBlocked, setMatchingBlocked] = useState(false);
  const [isCrisisCardOpen, setIsCrisisCardOpen] = useState(true);
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
    if (!text || busy) return;
    setInput("");
    setError(null);
    setBusy(true);

    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    sessionStore.setMessages(history);

    let reply = "";
    try {
      const profile = sessionStore.getProfile();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-MAX_TURNS * 2),
          checkin: sessionStore.getCheckin(),
          age_group: profile?.age_group,
          isCrisisCare: crisis,
        }),
      });
      if (!res.ok) throw new Error("chat failed");

      for await (const ev of readChatStream(res)) {
        // blocked / matchingBlocked は、どのイベントに付いていても「話を整理する」を無効にする
        if (isBlocked(ev)) applyFlags({ matchingBlocked: true });
        if (ev.type === "crisis") {
          applyFlags({ crisis: true, matchingBlocked: true });
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
        {messages.map((m, i) => {
          const isLatestBusyAssistant = busy && i === messages.length - 1 && m.role === "assistant" && !m.content;
          return (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {isLatestBusyAssistant ? (
                <div className="py-1">
                  <BreathingIndicator />
                </div>
              ) : (
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/80 bg-card shadow-hidamari-soft"
                  }`}
                >
                  {m.content}
                </div>
              )}
            </div>
          );
        })}

        {/* 危機検知時の心に寄り添う相談窓口・深呼吸カード（折りたたみ可能） */}
        {crisis && (
          <div role="alert" className="space-y-3 rounded-2xl border border-destructive/30 bg-card p-4 shadow-hidamari transition-all">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <Heart className="h-4 w-4" />
                <span>{COPY.consult.crisisTitle}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsCrisisCardOpen((v) => !v)}
                aria-expanded={isCrisisCardOpen}
                aria-label={isCrisisCardOpen ? "窓口案内を折りたたむ" : "窓口案内を展開する"}
              >
                <span className="mr-1">{isCrisisCardOpen ? "閉じる" : "相談窓口を見る"}</span>
                {isCrisisCardOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>

            <p className="leading-relaxed text-xs text-muted-foreground">
              話してくれてありがとうございます。いつでもあなたのペースで、専門の相談員さんに頼ることもできますよ。このままここでAIとお話を続けることもできます。
            </p>

            {isCrisisCardOpen && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                <BreatheGuide autoStart={false} />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">いつでも相談できる無料窓口:</p>
                  <HotlineList tone="crisis" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Button asChild variant="outline" size="sm" className="min-h-[36px]">
                    <Link href="/crisis">
                      <HeartHandshake className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                      {COPY.consult.crisisButton}
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={restart} className="text-xs text-muted-foreground min-h-[36px]">
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    {COPY.consult.newSession}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {!crisis && matchingBlocked && (
          <div role="status" className="space-y-2 rounded-lg border bg-secondary/40 px-4 py-2 text-xs text-muted-foreground">
            <p>{COPY.consult.matchingBlocked}</p>
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

      {/* チャット入力欄（危機検知時もロックせず、継続してAIと対話可能） */}
      <div className="sticky bottom-0 space-y-2 border-t bg-background pb-2 pt-3">
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

        <div className="flex flex-wrap items-center justify-between gap-3">
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
            <span className="text-xs text-muted-foreground">
              {crisis
                ? "いまはあなたのお気持ちをゆっくりお聴きすることを優先しています。"
                : COPY.consult.organizeHint}
            </span>
          </div>

          {crisis && (
            <Button variant="ghost" size="sm" onClick={restart} className="text-xs text-muted-foreground min-h-[32px]">
              <RotateCcw className="mr-1 h-3 w-3" />
              {COPY.consult.newSession}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
