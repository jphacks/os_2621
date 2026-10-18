"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclaimer } from "@/components/disclaimer";
import { api, ApiError, type Candidate } from "@/components/api";
import { sessionStore } from "@/components/session-store";
import { COPY, avatarEmoji } from "@/lib/copy";
import { AGE_GROUP_LABELS } from "@/lib/matching/score";

// P5 候補一覧（最大3件。つながるかどうかは本人が決める）
export default function CandidatesPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api<{ candidates: Candidate[]; received_count?: number }>("/api/match/candidates")
      .then((r) => {
        setCandidates(r.candidates.slice(0, 3));
        setReceivedCount(r.received_count ?? 0);
      })
      .catch((e) => {
        setLoadError(e instanceof ApiError && e.status === 403 ? e.userMessage || COPY.candidates.noSummary : COPY.generalError);
        setCandidates([]);
      });
  }, []);

  async function request(c: Candidate) {
    setMessage(null);
    try {
      const res = await api<{ id: string; room_id?: string; matched?: boolean }>("/api/match/requests", {
        body: { to_user: c.user_id, to_summary: c.summary_id },
      });
      if (res.matched && res.room_id) {
        sessionStore.addJoinedRoomId(res.room_id);
        router.push(`/rooms/${res.room_id}`);
        return;
      }
      setSent((prev) => new Set(prev).add(c.summary_id));
    } catch (e) {
      if (e instanceof ApiError) {
        setMessage(e.status === 429 ? COPY.candidates.limit : e.userMessage || COPY.requests.failed);
      } else {
        setMessage(COPY.requests.failed);
      }
    }
  }

  return (
    <div className="space-y-4">
      <Disclaimer />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{COPY.candidates.title}</h1>
        <p className="text-sm text-muted-foreground">{COPY.candidates.lead}</p>
      </div>

      {receivedCount > 0 && (
        <Card className="border-primary/40 bg-warmth-50/70 shadow-hidamari-soft">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
            <p className="text-sm font-medium text-foreground">
              あなた宛てに {receivedCount} 件のつながりリクエストが届いています。
            </p>
            <Button asChild size="sm" className="min-h-[40px]">
              <Link href="/requests">届いたリクエストを見る</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {candidates === null && (
        <p role="status" className="py-10 text-center text-sm text-muted-foreground">
          {COPY.candidates.loading}
        </p>
      )}

      {candidates?.length === 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6 text-sm leading-relaxed">
            <p role="status">{loadError ?? COPY.candidates.empty}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/summary">{COPY.candidates.back}</Link>
              </Button>
              {receivedCount > 0 && (
                <Button asChild>
                  <Link href="/requests">{COPY.candidates.toRequests}</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {candidates?.map((c) => (
        <Card key={c.summary_id} className="shadow-hidamari border-border/80 transition-shadow hover:shadow-hidamari-glow">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">
                {avatarEmoji(c.avatar)}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{c.nickname}</CardTitle>
                {c.is_same_age ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    同年代
                  </span>
                ) : c.age_group && AGE_GROUP_LABELS[c.age_group] ? (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {AGE_GROUP_LABELS[c.age_group]}
                  </span>
                ) : null}
                {c.incoming_request_id && (
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                    お相手からリクエストが届いています
                  </span>
                )}
              </div>
            </div>
            <CardDescription className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {c.share_text}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-xl border border-warmth-200/70 bg-warmth-50/60 px-3.5 py-2.5 text-xs text-warmth-900 leading-relaxed">
              {COPY.candidates.commonLabel}：{c.common_ground || COPY.candidates.fallbackCommon}
            </p>
            <Button onClick={() => void request(c)} disabled={sent.has(c.summary_id)} className="min-h-[44px]">
              {sent.has(c.summary_id)
                ? COPY.candidates.sent
                : c.incoming_request_id
                  ? COPY.requests.accept
                  : COPY.candidates.request}
            </Button>
          </CardContent>
        </Card>
      ))}

      {message && (
        <p role="alert" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <Button asChild variant="secondary">
        <Link href="/requests">{COPY.candidates.toRequests}</Link>
      </Button>
    </div>
  );
}
