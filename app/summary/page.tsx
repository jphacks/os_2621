"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Disclaimer } from "@/components/disclaimer";
import { api, ApiError, type SummaryDraft } from "@/components/api";
import { sessionStore } from "@/components/session-store";
import { COPY } from "@/lib/copy";

type State = "loading" | "ready" | "blocked" | "empty" | "failed";

// P4 要約の確認（本人が編集し、共有に同意したときだけ保存する）
export default function SummaryPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [draft, setDraft] = useState<SummaryDraft | null>(null);
  const [tagsText, setTagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const flags = sessionStore.getFlags();
    // UIでも止めるが、本当の拒否はAPI側で行われる（安全設計 3）
    if (flags.crisis || flags.matchingBlocked) {
      setState("blocked");
      return;
    }
    const messages = sessionStore.getMessages();
    if (!messages.some((m) => m.role === "user")) {
      setState("empty");
      return;
    }
    setState("loading");
    try {
      const d = await api<SummaryDraft>("/api/summarize", {
        body: { messages, checkin: sessionStore.getCheckin() },
      });
      setDraft(d);
      setTagsText(d.tags.join("、"));
      setState("ready");
    } catch {
      setState("failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function share() {
    if (!draft || saving || !draft.share_text.trim()) return;
    setSaving(true);
    setError(null);
    const tags = tagsText
      .split(/[、,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 6);
    try {
      await api("/api/summaries", {
        body: { ...draft, share_text: draft.share_text.trim(), tags, checkin: sessionStore.getCheckin() },
      });
      router.push("/candidates");
    } catch (e) {
      // 403 はサーバー側で「このセッションは共有できない」と判断されたとき
      if (e instanceof ApiError && e.status === 403) {
        setState("blocked");
      } else {
        setError(COPY.summary.saveFailed);
      }
      setSaving(false);
    }
  }

  if (state === "loading") {
    return (
      <p role="status" className="py-16 text-center text-sm text-muted-foreground">
        {COPY.summary.loading}
      </p>
    );
  }

  if (state !== "ready" || !draft) {
    const message =
      state === "blocked" ? COPY.summary.blocked : state === "empty" ? COPY.summary.noMessages : COPY.summary.failed;
    return (
      <Card>
        <CardContent className="space-y-4 pt-6 text-sm leading-relaxed">
          <p role="status">{message}</p>
          <div className="flex flex-wrap gap-3">
            {state === "failed" && <Button onClick={() => void load()}>{COPY.summary.retry}</Button>}
            <Button asChild variant="outline">
              <Link href="/consult">{COPY.crisis.back}</Link>
            </Button>
            {state === "blocked" && (
              <Button asChild variant="secondary">
                <Link href="/crisis">{COPY.consult.crisisButton}</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Disclaimer />
      <Card>
        <CardHeader>
          <CardTitle>{COPY.summary.title}</CardTitle>
          <CardDescription>{COPY.summary.lead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="share-text" className="text-sm font-medium">
              {COPY.summary.textLabel}
            </label>
            <Textarea
              id="share-text"
              rows={4}
              maxLength={200}
              value={draft.share_text}
              onChange={(e) => setDraft({ ...draft, share_text: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">{COPY.summary.visibleNote}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="category" className="text-sm font-medium">
              {COPY.summary.categoryLabel}
            </label>
            <select
              id="category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="min-h-[44px] w-full rounded-lg border border-input bg-background px-3 text-base"
            >
              {Object.entries(COPY.categories).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="tags" className="text-sm font-medium">
              {COPY.summary.tagsLabel}
            </label>
            <Input id="tags" value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">{COPY.summary.shareHint}</p>
          {error && (
            <p role="alert" className="text-sm text-muted-foreground">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => void share()} disabled={saving || !draft.share_text.trim()}>
            {COPY.summary.share}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/consult">{COPY.summary.decline}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
