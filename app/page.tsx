"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { History, Inbox, MessageCircleHeart, MessagesSquare, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { sessionStore } from "@/components/session-store";
import { COPY, avatarEmoji } from "@/lib/copy";

type RoomSummary = {
  id: string;
  status: "active" | "ended";
  started_at: string;
  ends_at: string;
  partner_nickname: string;
  partner_avatar: string;
  left: boolean;
};

// P0 トップ / 利用上の注意
export default function TopPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [canResumeConsult, setCanResumeConsult] = useState(false);
  const [hasSavedMessages, setHasSavedMessages] = useState(false);
  const [canAccessRequests, setCanAccessRequests] = useState(false);
  const [pendingReceivedCount, setPendingReceivedCount] = useState(0);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  useEffect(() => {
    const applyLocalState = () => {
      const state = sessionStore.getFlowState();
      if (state.hasProfile && state.hasCheckin) {
        setCanResumeConsult(true);
        setHasSavedMessages(state.hasMessages);
        if (!state.isCrisis && !state.isMatchingBlocked) {
          setCanAccessRequests(true);
        }
      }
      const savedActiveRoom = sessionStore.getActiveRoomId();
      if (savedActiveRoom && !state.isCrisis && !state.isMatchingBlocked) {
        setActiveRoomId(savedActiveRoom);
      }
    };

    applyLocalState();

    // タブを閉じた後などでローカルに状態がない場合も、サーバーセッションから復元を試みる
    let cancelled = false;
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (cancelled || !me) return;
        if (me.profile && !sessionStore.getProfile()) {
          sessionStore.setProfile(me.profile);
        }
        if (me.checkin && !sessionStore.getCheckin()) {
          sessionStore.setCheckin(me.checkin);
        }
        if (me.summaryShared) {
          sessionStore.setSummaryShared(true);
          if (!sessionStore.getFlowState().hasMessages && me.summaryText) {
            sessionStore.setMessages([{ role: "user", content: me.summaryText }]);
          }
        }
        if (Array.isArray(me.joinedRoomIds)) {
          me.joinedRoomIds.forEach((id: string) => sessionStore.addJoinedRoomId(id));
        }
        if (me.activeRoomId !== undefined) {
          sessionStore.setActiveRoomId(me.activeRoomId ?? null);
          setActiveRoomId(me.activeRoomId ?? null);
        }
        if (Array.isArray(me.rooms)) {
          setRooms(me.rooms as RoomSummary[]);
        }
        if (typeof me.pendingReceivedCount === "number") {
          setPendingReceivedCount(me.pendingReceivedCount);
        }
        if (me.isCrisis || me.isMatchingBlocked) {
          sessionStore.setFlags({ crisis: Boolean(me.isCrisis), matchingBlocked: Boolean(me.isMatchingBlocked) });
        }

        const updated = sessionStore.getFlowState();
        if (updated.hasProfile && updated.hasCheckin) {
          setCanResumeConsult(true);
          setHasSavedMessages(updated.hasMessages);
          if (!updated.isCrisis && !updated.isMatchingBlocked) {
            setCanAccessRequests(true);
          }
        }

        // 人間とのチャット中にタブを閉じて再度ブラウザを開いた場合、自動でそのチャット画面を開く
        if (me.activeRoomId && !me.isCrisis && !me.isMatchingBlocked) {
          let alreadyAutoOpened = false;
          try {
            alreadyAutoOpened = window.sessionStorage?.getItem("hidamari.homeAutoRoomOpened") === "1";
            window.sessionStorage?.setItem("hidamari.homeAutoRoomOpened", "1");
          } catch {
            // noop
          }
          if (!alreadyAutoOpened) {
            router.replace(`/rooms/${me.activeRoomId}`);
          }
        }
      })
      .catch(() => {
        // noop
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="space-y-6">
      {activeRoomId && (
        <Card className="border-primary bg-warmth-100/80 shadow-hidamari">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                現在進行中のチャットルームがあります
              </p>
              <p className="text-xs text-muted-foreground">
                タブを閉じた前の続きから、すぐにお相手とのチャットルームに戻れます。
              </p>
            </div>
            <Button asChild size="sm" className="min-h-[40px] shadow-sm">
              <Link href={`/rooms/${activeRoomId}`}>
                <MessagesSquare className="mr-1.5 h-4 w-4" aria-hidden="true" />
                <span>チャットルームに戻る</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {(canResumeConsult || canAccessRequests) && (
        <Card className="border-primary/40 bg-warmth-50/80 shadow-hidamari-soft">
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  {hasSavedMessages ? "以前のチャット記録・進行中のステップから再開できます" : "前回のつづきからすぐにお使いいただけます"}
                </p>
                <p className="text-xs text-muted-foreground">
                  タブを閉じても、以前のAIとの会話記録やリクエスト・ルームの履歴にいつでもアクセスできます。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canResumeConsult && (
                  <Button asChild size="sm" className="min-h-[40px] shadow-sm">
                    <Link href="/consult">
                      <MessageCircleHeart className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      <span>Step 3: AIとのチャット画面へ</span>
                    </Link>
                  </Button>
                )}
                {canAccessRequests && (
                  <Button asChild variant="secondary" size="sm" className="min-h-[40px] shadow-sm">
                    <Link href="/requests">
                      <Inbox className="mr-1.5 h-4 w-4" aria-hidden="true" />
                      <span>
                        Step 6: リクエスト画面へ
                        {pendingReceivedCount > 0 ? `（${pendingReceivedCount}件）` : ""}
                      </span>
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {rooms.length > 0 && (
              <div className="space-y-2 border-t border-warmth-200/70 pt-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <History className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>以前の人間とのチャット記録</span>
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {rooms.slice(0, 4).map((rm) => (
                    <Link
                      key={rm.id}
                      href={`/rooms/${rm.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-background/80 px-3 py-2 text-xs hover:bg-accent/50 transition-colors"
                    >
                      <span className="flex items-center gap-2 font-medium truncate">
                        <span aria-hidden="true">{avatarEmoji(rm.partner_avatar)}</span>
                        <span className="truncate">{rm.partner_nickname}とのチャット</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-primary font-medium">
                        {rm.status === "active" ? "対話中 →" : "記録を見る →"}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-hidamari border-warmth-200/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sun className="h-6 w-6 text-primary animate-breathe-pulse" aria-hidden="true" />
            <CardTitle className="text-xl">{COPY.appName}へようこそ</CardTitle>
          </div>
          <CardDescription className="leading-relaxed">{COPY.top.lead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm leading-relaxed">
          <ul className="space-y-2">
            {COPY.top.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden="true">🌱</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-2 rounded-xl border border-warmth-200/70 bg-warmth-50/50 p-4">
            <p className="font-medium text-warmth-900">ご利用にあたっての大切なお願い</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {COPY.top.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-background/60 p-3 hover:bg-warmth-50/50 transition-colors">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-5 w-5 accent-[hsl(var(--primary))]"
            />
            <span className="font-medium">{COPY.top.consent}</span>
          </label>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          {agreed ? (
            <Button asChild size="lg" className="min-h-[44px] shadow-sm">
              <Link href="/start">{COPY.top.start}</Link>
            </Button>
          ) : (
            <Button size="lg" disabled className="min-h-[44px]">
              {COPY.top.start}
            </Button>
          )}
          <Button asChild variant="secondary" size="lg" className="min-h-[44px]">
            <Link href="/consult">
              <MessageCircleHeart className="mr-1.5 h-4 w-4" aria-hidden="true" />
              <span>Step 3: AIとのチャット画面</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-h-[44px]">
            <Link href="/requests">
              <Inbox className="mr-1.5 h-4 w-4" aria-hidden="true" />
              <span>
                Step 6: リクエスト画面
                {pendingReceivedCount > 0 ? `（${pendingReceivedCount}件）` : ""}
              </span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link href="/crisis">相談窓口を見る</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

