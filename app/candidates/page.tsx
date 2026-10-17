"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Disclaimer } from "@/components/disclaimer";
import { api, ApiError, type Candidate } from "@/components/api";
import { COPY, avatarEmoji } from "@/lib/copy";

// P5 候補一覧（最大3件。つながるかどうかは本人が決める）
export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api<{ candidates: Candidate[] }>("/api/match/candidates")
      .then((r) => setCandidates(r.candidates.slice(0, 3)))
      .catch((e) => {
        setLoadError(e instanceof ApiError && e.status === 403 ? COPY.candidates.noSummary : COPY.generalError);
        setCandidates([]);
      });
  }, []);

  async function request(c: Candidate) {
    setMessage(null);
    try {
      await api("/api/match/requests", { body: { to_user: c.user_id, to_summary: c.summary_id } });
      setSent((prev) => new Set(prev).add(c.summary_id));
    } catch (e) {
      setMessage(e instanceof ApiError && e.status === 429 ? COPY.candidates.limit : COPY.requests.failed);
    }
  }

  return (
    <div className="space-y-4">
      <Disclaimer />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">{COPY.candidates.title}</h1>
        <p className="text-sm text-muted-foreground">{COPY.candidates.lead}</p>
      </div>

      {candidates === null && (
        <p role="status" className="py-10 text-center text-sm text-muted-foreground">
          {COPY.candidates.loading}
        </p>
      )}

      {candidates?.length === 0 && (
        <Card>
          <CardContent className="space-y-4 pt-6 text-sm leading-relaxed">
            <p role="status">{loadError ?? COPY.candidates.empty}</p>
            <Button asChild variant="outline">
              <Link href="/summary">{COPY.candidates.back}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {candidates?.map((c) => (
        <Card key={c.summary_id}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">
                {avatarEmoji(c.avatar)}
              </span>
              <CardTitle className="text-base">{c.nickname}</CardTitle>
            </div>
            <CardDescription className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {c.share_text}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
              {COPY.candidates.commonLabel}：{c.common_ground || COPY.candidates.fallbackCommon}
            </p>
            <Button onClick={() => void request(c)} disabled={sent.has(c.summary_id)}>
              {sent.has(c.summary_id) ? COPY.candidates.sent : COPY.candidates.request}
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
