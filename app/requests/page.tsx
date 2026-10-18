"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api, type RequestsResponse } from "@/components/api";
import { COPY, avatarEmoji } from "@/lib/copy";
import { sessionStore } from "@/components/session-store";
import { createClient } from "@/lib/supabase/client";

const POLL_MS = 8000;

// P6 リクエスト（届いたものへの承諾 / 見送りと、送ったものの状態）
export default function RequestsPage() {
  const router = useRouter();
  const [data, setData] = useState<RequestsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api<RequestsResponse>("/api/match/requests");
      setData(res);
      res.sent.forEach((r) => {
        if (r.status === "accepted" && r.room_id) {
          sessionStore.addJoinedRoomId(r.room_id);
        }
      });
    } catch {
      setError(COPY.generalError);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);

    // 届いたリクエストを即座に表示する（Realtime）。使えないときはポーリングだけで動く
    let cleanup = () => {};
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabase = createClient();
      const channel = supabase
        .channel("match_requests_watch")
        .on("postgres_changes", { event: "*", schema: "public", table: "match_requests" }, () => void refresh())
        .subscribe();
      cleanup = () => void supabase.removeChannel(channel);
    }
    return () => {
      clearInterval(timer);
      cleanup();
    };
  }, [refresh]);

  async function respond(id: string, accept: boolean) {
    setError(null);
    try {
      const r = await api<{ room_id?: string }>(`/api/match/requests/${id}/respond`, { body: { accept } });
      if (accept && r.room_id) {
        sessionStore.addJoinedRoomId(r.room_id);
        router.push(`/rooms/${r.room_id}`);
      } else {
        await refresh();
      }
    } catch {
      setError(COPY.requests.failed);
    }
  }

  const received = data?.received.filter((r) => r.status === "pending") ?? [];
  const sent = data?.sent ?? [];
  const statusLabel = {
    pending: COPY.requests.waiting,
    accepted: COPY.requests.accepted,
    declined: COPY.requests.declined,
    expired: COPY.requests.expired,
  } as const;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{COPY.requests.title}</h1>
        <p className="text-sm text-muted-foreground">{COPY.requests.lead}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-muted-foreground">
          {error}
        </p>
      )}

      <section className="space-y-3" aria-labelledby="received-title">
        <h2 id="received-title" className="text-sm font-medium">
          {COPY.requests.received}
        </h2>
        {received.length === 0 && <p className="text-sm text-muted-foreground">{COPY.requests.noneReceived}</p>}
        {received.map((r) => (
          <Card key={r.id} className="shadow-hidamari">
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  {avatarEmoji(r.from_avatar)}
                </span>
                <span className="font-medium">{r.from_nickname}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.share_text}</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void respond(r.id, true)} className="min-h-[44px]">{COPY.requests.accept}</Button>
                <Button variant="outline" onClick={() => void respond(r.id, false)} className="min-h-[44px]">
                  {COPY.requests.decline}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-3" aria-labelledby="sent-title">
        <h2 id="sent-title" className="text-sm font-medium">
          {COPY.requests.sentTitle}
        </h2>
        {sent.length === 0 && <p className="text-sm text-muted-foreground">{COPY.requests.noneSent}</p>}
        {sent.map((r) => (
          <Card key={r.id} className="shadow-hidamari">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">
                  {avatarEmoji(r.to_avatar)}
                </span>
                <div>
                  <p className="font-medium">{r.to_nickname}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel[r.status]}</p>
                </div>
              </div>
              {r.status === "accepted" && r.room_id && (
                <Button asChild className="min-h-[44px]">
                  <Link href={`/rooms/${r.room_id}`}>{COPY.requests.enter}</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <Button asChild variant="outline">
        <Link href="/candidates">{COPY.requests.toCandidates}</Link>
      </Button>
    </div>
  );
}
