"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { HotlineList } from "@/components/hotline-list";
import { Disclaimer } from "@/components/disclaimer";
import { api } from "@/components/api";
import { sessionStore } from "@/components/session-store";
import { COPY } from "@/lib/copy";
import { createClient } from "@/lib/supabase/client";

const PII_PATTERN = /@|https?:|www\.|\.com|\.jp|\d{2,}[-\s]?\d{2,}/i;

// P9 設定（ニックネーム変更・窓口一覧・全データ削除）
export default function SettingsPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [nickMsg, setNickMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNickname(sessionStore.getProfile()?.nickname ?? "");
  }, []);

  async function saveNickname(e: React.FormEvent) {
    e.preventDefault();
    const name = nickname.trim();
    if (name.length < 2 || name.length > 12) return setNickMsg(COPY.start.errors.length);
    if (PII_PATTERN.test(name)) return setNickMsg(COPY.start.errors.pii);
    setBusy(true);
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error("no user");
        const { error } = await supabase.from("profiles").update({ nickname: name }).eq("id", data.user.id);
        if (error) throw error;
      }
      const profile = sessionStore.getProfile();
      sessionStore.setProfile({ nickname: name, avatar: profile?.avatar ?? "sun" });
      setNickMsg(COPY.settings.nicknameSaved);
    } catch {
      setNickMsg(COPY.generalError);
    }
    setBusy(false);
  }

  async function deleteAll() {
    setBusy(true);
    setDeleteMsg(null);
    try {
      await api("/api/me", { method: "DELETE" });
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) await createClient().auth.signOut();
      sessionStorage.clear();
      router.push("/");
    } catch {
      setDeleteMsg(COPY.settings.deleteFailed);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">{COPY.settings.title}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{COPY.settings.nicknameTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveNickname} className="space-y-3">
            <Input
              value={nickname}
              maxLength={12}
              autoComplete="off"
              aria-label={COPY.start.nicknameLabel}
              onChange={(e) => setNickname(e.target.value)}
            />
            {nickMsg && (
              <p role="status" className="text-sm text-muted-foreground">
                {nickMsg}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {COPY.settings.nicknameSave}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{COPY.settings.hotlinesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <HotlineList />
          <Disclaimer />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{COPY.settings.deleteTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="leading-relaxed text-muted-foreground">{COPY.settings.deleteLead}</p>
          {deleteMsg && (
            <p role="alert" className="text-muted-foreground">
              {deleteMsg}
            </p>
          )}
          {confirming ? (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void deleteAll()} disabled={busy}>
                {COPY.settings.deleteConfirm}
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
                {COPY.settings.deleteCancel}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirming(true)}>
              {COPY.settings.deleteStart}
            </Button>
          )}
        </CardContent>
      </Card>

      <Button asChild variant="ghost">
        <Link href="/">{COPY.crisis.top}</Link>
      </Button>
    </div>
  );
}
