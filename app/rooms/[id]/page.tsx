"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Flag, Heart, HeartHandshake, LogOut, Phone, Send, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScaleInput } from "@/components/scale-input";
import { BreatheGuide } from "@/components/breathe-guide";
import { HotlineList } from "@/components/hotline-list";
import { CallPanel, CallPreConfirmModal } from "@/components/room/call-panel";
import { api } from "@/components/api";
import { sessionStore } from "@/components/session-store";
import { COPY, avatarEmoji } from "@/lib/copy";
import { getFacilitatorConfig } from "@/lib/facilitator/config";
import { createClient } from "@/lib/supabase/client";
import { useRoomCall } from "@/lib/webrtc/useRoomCall";

const DEMO_FAST = process.env.NEXT_PUBLIC_DEMO_FAST_TIMER === "true";

type Message = {
  id: string;
  sender_id: string | null;
  sender_type: "user" | "ai" | "system";
  body: string;
  created_at: string;
};
type RoomRow = { status: "active" | "ended"; end_reason: string | null; started_at: string; ends_at: string };
type Person = { nickname: string; avatar: string };

const DEMO_MESSAGES: Message[] = [
  { id: "d1", sender_id: null, sender_type: "ai", body: "お二人とも、新しい環境で居場所を探しているそうです。よければ、今日の気分をひとことずつ教えてください。", created_at: "" },
  { id: "d2", sender_id: "partner", sender_type: "user", body: "こんにちは。最近、少し疲れ気味です。", created_at: "" },
];

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// P7 チャットルーム（退出・ブロック・通報は常にヘッダーに表示し、1タップで実行できる）
export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const demo = id === "demo" || !process.env.NEXT_PUBLIC_SUPABASE_URL;

  const [me, setMe] = useState<string | null>(demo ? "me" : null);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [messages, setMessages] = useState<Message[]>(demo ? DEMO_MESSAGES : []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const [endedText, setEndedText] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [loadFailed, setLoadFailed] = useState(false);
  const [review, setReview] = useState({ mood: 3, energy: 3 });
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const firedRef = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const partnerId = Object.keys(people).find((k) => k !== me) ?? (demo ? "partner" : null);
  const partnerNickname = (partnerId ? people[partnerId]?.nickname : undefined) ?? "お相手";
  const ended = !!endedText || crisis;

  const mergeMessages = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.id, m]));
      incoming.forEach((m) => map.set(m.id, m));
      return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const handleCallConnected = useCallback(() => {
    mergeMessages([
      {
        id: `call-ai-${Date.now()}`,
        sender_id: null,
        sender_type: "ai",
        body: COPY.call.aiFacilitatorJoined,
        created_at: new Date().toISOString(),
      },
    ]);
  }, [mergeMessages]);

  const call = useRoomCall({
    roomId: id,
    userId: me ?? (demo ? "me" : ""),
    isDemo: demo,
    partnerNickname,
    onConnected: handleCallConnected,
  });

  useEffect(() => {
    if (ended && call.state.status !== "idle" && call.state.status !== "ended") {
      call.endCall();
    }
  }, [ended, call]);

  const handleDeletedMessage = useCallback((deletedId: string | undefined, currentUid: string | null) => {
    if (!deletedId) return;
    setMessages((prev) => {
      const target = prev.find((m) => m.id === deletedId);
      if (target && currentUid && target.sender_id === currentUid) {
        // 自分の発言が L2 危機判定によって取り消された場合は危機対応案内を表示する
        setCrisis(true);
      }
      return prev.filter((m) => m.id !== deletedId);
    });
  }, []);

  const applyRoom = useCallback(
    (r: RoomRow) => {
      setRoom(r);
      if (r.status === "ended") {
        setEndedText(
          r.end_reason === "report" ? COPY.room.endedReport : r.end_reason === "safety" ? COPY.room.endedSafety : COPY.room.ended
        );
        if (!demo && sessionStore.getActiveRoomId() === id) {
          sessionStore.setActiveRoomId(null);
        }
      } else if (!demo && new Date(r.ends_at).getTime() > Date.now()) {
        sessionStore.setActiveRoomId(id);
      }
    },
    [demo, id]
  );

  // 初期読み込みと Realtime の購読
  useEffect(() => {
    if (demo) {
      setRoom({ status: "active", end_reason: null, started_at: new Date().toISOString(), ends_at: new Date(Date.now() + 30 * 60000).toISOString() });
      setPeople({ me: { nickname: "あなた", avatar: "sun" }, partner: { nickname: "ことりさん（デモ）", avatar: "bird" } });
      return;
    }
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        const [roomRes, memberRes, msgRes] = await Promise.all([
          supabase.from("rooms").select("status,end_reason,started_at,ends_at").eq("id", id).single(),
          supabase.from("room_members").select("user_id,left_at").eq("room_id", id),
          supabase.from("room_messages").select("id,sender_id,sender_type,body,created_at").eq("room_id", id).order("created_at"),
        ]);
        if (cancelled) return;
        if (roomRes.error || !roomRes.data || !uid) throw new Error("load");
        setMe(uid);
        sessionStore.addJoinedRoomId(id);
        applyRoom(roomRes.data as RoomRow);
        mergeMessages((msgRes.data ?? []) as Message[]);

        const ids = (memberRes.data ?? []).map((m) => m.user_id);
        const { data: profiles } = await supabase.from("profiles").select("id,nickname,avatar").in("id", ids);
        if (cancelled) return;
        setPeople(Object.fromEntries((profiles ?? []).map((p) => [p.id, { nickname: p.nickname, avatar: p.avatar }])));
        if ((memberRes.data ?? []).some((m) => m.user_id === uid && m.left_at)) {
          setEndedText(COPY.room.ended);
          if (sessionStore.getActiveRoomId() === id) sessionStore.setActiveRoomId(null);
        }
        if ((memberRes.data ?? []).some((m) => m.user_id !== uid && m.left_at)) {
          mergeMessages([{ id: "partner-left", sender_id: null, sender_type: "system", body: COPY.room.partnerLeft, created_at: "~" }]);
        }

        channel = supabase
          .channel(`room_${id}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${id}` }, (p) =>
            mergeMessages([p.new as Message])
          )
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "room_messages" }, (p) =>
            handleDeletedMessage((p.old as { id?: string } | undefined)?.id, uid)
          )
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${id}` }, (p) =>
            applyRoom(p.new as RoomRow)
          )
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "room_members", filter: `room_id=eq.${id}` }, (p) => {
            const row = p.new as { user_id: string; left_at: string | null };
            if (row.user_id !== uid && row.left_at) {
              mergeMessages([{ id: "partner-left", sender_id: null, sender_type: "system", body: COPY.room.partnerLeft, created_at: "~" }]);
            }
          })
          .subscribe();
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [id, demo, applyRoom, mergeMessages, handleDeletedMessage]);

  // 残り時間と、25分・30分・沈黙のファシリテーター呼び出し
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const endsAt = room ? new Date(room.ends_at).getTime() : 0;
  const startedAt = room ? new Date(room.started_at).getTime() : 0;
  const remaining = endsAt - now;

  useEffect(() => {
    if (!room || demo || ended) return;
    const duration = endsAt - startedAt;
    const fire = (key: string, event: "time_warning" | "closing" | "silence") => {
      if (firedRef.current.has(key)) return;
      firedRef.current.add(key);
      void api(`/api/rooms/${id}/facilitate`, { body: { event } }).catch(() => {});
    };
    if (now - startedAt >= (duration * 5) / 6) fire("time_warning", "time_warning");
    if (now >= endsAt) fire("closing", "closing");

    const cfg = getFacilitatorConfig(DEMO_FAST);
    const nonSystem = messages.filter((m) => m.sender_type !== "system" && m.created_at);
    const lastMsgAt = nonSystem.length > 0 ? new Date(nonSystem[nonSystem.length - 1].created_at).getTime() : startedAt;
    if (lastMsgAt > 0 && now - lastMsgAt >= cfg.SILENCE_THRESHOLD_MS) {
      fire(`silence_${lastMsgAt}`, "silence");
    }
  }, [now, room, demo, ended, endsAt, startedAt, id, messages]);

  useEffect(() => {
    if (room?.status === "active" && endsAt && now >= endsAt && !endedText) {
      setEndedText(COPY.room.ended);
      if (!demo && sessionStore.getActiveRoomId() === id) {
        sessionStore.setActiveRoomId(null);
      }
    }
  }, [now, room, endsAt, endedText, demo, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, ended]);

  async function send() {
    const body = input.trim();
    if (!body || busy || ended) return;
    setBusy(true);
    setNotice(null);
    if (demo) {
      mergeMessages([{ id: `l${Date.now()}`, sender_id: "me", sender_type: "user", body, created_at: new Date().toISOString() }]);
      setInput("");
      setBusy(false);
      return;
    }
    try {
      const r = await api<{ type?: string; masked?: boolean }>(`/api/rooms/${id}/messages`, { body: { body } });
      setInput("");
      if (r.type === "crisis") {
        // 危機を表す発言は相手に届かない。本人にだけ窓口を案内する
        setCrisis(true);
        if (sessionStore.getActiveRoomId() === id) sessionStore.setActiveRoomId(null);
      } else if (r.masked) {
        setNotice(COPY.room.masked);
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("room_messages")
        .select("id,sender_id,sender_type,body,created_at")
        .eq("room_id", id)
        .order("created_at");
      mergeMessages((data ?? []) as Message[]);
    } catch {
      setNotice(COPY.room.sendFailed);
    }
    setBusy(false);
  }

  async function leave() {
    call.endCall();
    if (!demo && sessionStore.getActiveRoomId() === id) sessionStore.setActiveRoomId(null);
    if (!demo) await api(`/api/rooms/${id}/leave`, { method: "POST", body: {} }).catch(() => {});
    setEndedText(COPY.room.ended);
  }

  async function block() {
    call.endCall();
    if (!demo && sessionStore.getActiveRoomId() === id) sessionStore.setActiveRoomId(null);
    if (!demo && partnerId) await api("/api/blocks", { body: { blocked_user_id: partnerId, room_id: id } }).catch(() => {});
    setEndedText(COPY.room.ended);
  }

  async function report(reason: string) {
    call.endCall();
    setReporting(false);
    if (!demo && sessionStore.getActiveRoomId() === id) sessionStore.setActiveRoomId(null);
    if (!demo && partnerId) await api("/api/reports", { body: { reported_user_id: partnerId, room_id: id, reason } }).catch(() => {});
    setEndedText(COPY.room.endedReport);
  }

  async function submitReview() {
    await api("/api/checkin", { body: review }).catch(() => {});
    router.push("/consult");
  }

  if (loadFailed) {
    return (
      <div className="space-y-4 py-10 text-center text-sm">
        <p role="alert">{COPY.room.loadFailed}</p>
        <Button asChild variant="outline">
          <Link href="/requests">{COPY.candidates.toRequests}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col">
      {/* 常に表示するヘッダー: 残り時間・退出・ブロック・通報・通話提案 */}
      <div className="sticky top-[var(--header-h,65px)] z-30 -mx-4 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap" aria-live="off">
              {COPY.room.remaining} <span className="font-mono">{room ? formatRemaining(remaining) : "--:--"}</span>
            </span>
            {/* 音声通話提案ボタン（通話中でなく、ルームが終了していないとき） */}
            {!ended && call.state.status === "idle" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCallModalOpen(true)}
                className="border-primary/40 text-primary hover:bg-primary/5 min-h-[32px] text-xs px-2 sm:px-3"
              >
                <Phone className="mr-1 h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {COPY.call.proposeButton}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button size="sm" variant="outline" className="px-2 sm:px-3 text-xs sm:text-sm min-h-[32px]" onClick={() => void leave()} disabled={ended}>
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              <span>{COPY.room.leave}</span>
            </Button>
            <Button size="sm" variant="outline" className="px-2 sm:px-3 text-xs sm:text-sm min-h-[32px]" onClick={() => void block()} disabled={ended}>
              <ShieldOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              <span>{COPY.room.block}</span>
            </Button>
            <Button size="sm" variant="outline" className="px-2 sm:px-3 text-xs sm:text-sm min-h-[32px]" onClick={() => setReporting((v) => !v)} disabled={ended}>
              <Flag className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              <span>{COPY.room.report}</span>
            </Button>
          </div>
        </div>
        {reporting && (
          <div className="mt-2 space-y-2 rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{COPY.room.reportTitle}</p>
            <div className="flex flex-wrap gap-2">
              {COPY.room.reportReasons.map((r) => (
                <Button key={r.id} size="sm" variant="secondary" onClick={() => void report(r.id)}>
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* 通話パネル（リクエスト中、受信中、接続中、通話中、エラー表示時） */}
        {(call.state.status !== "idle" && call.state.status !== "ended") || call.state.errorMessage ? (
          <div className="pt-2">
            <CallPanel
              state={call.state}
              formattedDuration={call.formattedDuration}
              partnerNickname={call.partnerNickname}
              onAccept={call.acceptCall}
              onReject={call.rejectCall}
              onCancel={call.cancelCall}
              onEnd={call.endCall}
              onToggleMute={call.toggleMute}
            />
          </div>
        ) : null}
      </div>

      {demo && <p className="pt-2 text-center text-xs text-muted-foreground">{COPY.room.demoNote}</p>}

      <div className="flex-1 space-y-3 py-4" aria-live="polite">
        {messages.map((m) => {
          if (m.sender_type === "system") {
            return (
              <p key={m.id} className="text-center text-xs text-muted-foreground">
                {m.body}
              </p>
            );
          }
          const mine = m.sender_type === "user" && m.sender_id === me;
          const person = m.sender_id ? people[m.sender_id] : undefined;
          const isAi = m.sender_type === "ai";
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <span className="mb-0.5 px-1 text-[11px] text-muted-foreground">
                {isAi ? `🌿 ${COPY.room.ai}` : mine ? "" : `${avatarEmoji(person?.avatar)} ${person?.nickname ?? ""}`}
              </span>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all ${
                  isAi
                    ? "border border-dashed border-warmth-300/90 bg-warmth-50/80 text-foreground"
                    : mine
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/80 bg-card shadow-hidamari-soft"
                }`}
              >
                {m.body}
              </div>
            </div>
          );
        })}

        {crisis && (
          <div role="alert" className="space-y-4 rounded-2xl border border-destructive/30 bg-card p-5 shadow-hidamari">
            <div className="flex items-center gap-2 text-destructive font-medium text-sm">
              <Heart className="h-4 w-4" aria-hidden="true" />
              <span>{COPY.consult.crisisTitle}</span>
            </div>
            <p className="leading-relaxed text-sm text-foreground">
              ここまで話してくれてありがとうございます。いま抱えているつらいお気持ちを、どうか一人で抱え込まないでください。
            </p>
            <p className="leading-relaxed text-xs text-muted-foreground">
              安全のため、ピア同士のチャットルームは一度終了させていただきました。あなたの心と命を守るため、いつでも頼れる専門窓口や、あなたのペースで話せるAI相談ルームをご用意しています。
            </p>

            <BreatheGuide autoStart={false} />

            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-foreground">いつでも相談できる無料窓口:</p>
              <HotlineList tone="crisis" />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild variant="outline" className="min-h-[44px]">
                <Link href="/consult">
                  <Bot className="mr-2 h-4 w-4 text-primary" aria-hidden="true" />
                  <span>AI相談ルームで今の気持ちをゆっくり話す</span>
                </Link>
              </Button>
              <Button asChild variant="destructive" className="min-h-[44px]">
                <Link href="/crisis">
                  <HeartHandshake className="mr-2 h-4 w-4" aria-hidden="true" />
                  <span>{COPY.consult.crisisButton}</span>
                </Link>
              </Button>
            </div>
          </div>
        )}

        {endedText && !crisis && (
          <div className="space-y-5 rounded-2xl border bg-card p-5 shadow-hidamari">
            <p role="status" className="rounded-lg bg-secondary/50 py-2 text-center text-sm font-medium text-foreground">
              {endedText}
            </p>

            <BreatheGuide autoStart={false} />

            <div className="space-y-3 border-t pt-3">
              <p className="text-sm font-semibold">{COPY.room.reviewTitle}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{COPY.room.reviewLead}</p>
              <ScaleInput id="r-mood" label={COPY.checkin.moodLabel} value={review.mood} onChange={(v) => setReview({ ...review, mood: v })} scale={COPY.checkin.moodScale} />
              <ScaleInput id="r-energy" label={COPY.checkin.energyLabel} value={review.energy} onChange={(v) => setReview({ ...review, energy: v })} scale={COPY.checkin.energyScale} />
              <div className="flex flex-wrap gap-3 pt-2">
                <Button onClick={() => void submitReview()} className="min-h-[44px]">{COPY.room.reviewSubmit}</Button>
                <Button asChild variant="outline" className="min-h-[44px]">
                  <Link href="/candidates">{COPY.room.reviewSkip}</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!ended && (
        <div className="sticky bottom-0 space-y-2 border-t bg-background pb-2 pt-3">
          {notice && (
            <p role="status" className="text-xs text-muted-foreground">
              {notice}
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              rows={2}
              maxLength={500}
              value={input}
              placeholder={COPY.room.placeholder}
              aria-label="メッセージ"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button onClick={() => void send()} disabled={busy || !input.trim()} aria-label={COPY.room.send}>
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{COPY.room.send}</span>
            </Button>
          </div>
        </div>
      )}

      {/* 音声通話開始前の安心確認モーダル */}
      <CallPreConfirmModal
        isOpen={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        onConfirm={call.requestCall}
      />
    </div>
  );
}
