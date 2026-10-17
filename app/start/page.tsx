"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AVATARS, COPY } from "@/lib/copy";
import { sessionStore } from "@/components/session-store";
import { createClient } from "@/lib/supabase/client";

// メールアドレス・電話番号・URL らしき文字列を弾く（SPEC §5.1）
const PII_PATTERN = /@|https?:|www\.|\.com|\.jp|\d{2,}[-\s]?\d{2,}/i;

function validateNickname(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2 || name.length > 12) return COPY.start.errors.length;
  if (PII_PATTERN.test(name)) return COPY.start.errors.pii;
  return null;
}

// P1 はじめる（匿名サインイン + profiles 作成）
export default function StartPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateNickname(nickname);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setBusy(true);
    const name = nickname.trim();

    try {
      // Supabase 未設定のローカル確認時は、サインインを飛ばして画面確認だけできるようにする
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const supabase = createClient();
        const { data: session } = await supabase.auth.getSession();
        let userId = session.session?.user.id;
        if (!userId) {
          const { data, error: signInError } = await supabase.auth.signInAnonymously();
          if (signInError || !data.user) throw signInError ?? new Error("no user");
          userId = data.user.id;
        }
        const { error: upsertError } = await supabase
          .from("profiles")
          .upsert({ id: userId, nickname: name, avatar });
        if (upsertError) throw upsertError;
      }
      sessionStore.setProfile({ nickname: name, avatar });
      router.push("/checkin");
    } catch (e) {
      // 原因の調査用（エラーの種類とメッセージだけ。ニックネームなどの入力は出さない）
      const err = e as { name?: string; message?: string; status?: number; code?: string };
      console.warn("[start] sign-in failed", { name: err?.name, message: err?.message, status: err?.status, code: err?.code });
      setError(COPY.start.errors.signIn);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{COPY.start.title}</CardTitle>
          <CardDescription>{COPY.start.lead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="nickname" className="text-sm font-medium">
              {COPY.start.nicknameLabel}
            </label>
            <Input
              id="nickname"
              value={nickname}
              maxLength={12}
              autoComplete="off"
              placeholder={COPY.start.nicknamePlaceholder}
              onChange={(e) => setNickname(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? "nickname-error" : undefined}
            />
            {error && (
              <p id="nickname-error" role="alert" className="text-sm text-muted-foreground">
                {error}
              </p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{COPY.start.avatarLabel}</legend>
            <div className="grid grid-cols-4 gap-2">
              {AVATARS.map((a) => (
                <label
                  key={a.id}
                  className={`flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs transition-colors ${
                    avatar === a.id ? "border-primary bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="avatar"
                    value={a.id}
                    checked={avatar === a.id}
                    onChange={() => setAvatar(a.id)}
                    className="sr-only"
                  />
                  <span className="text-2xl" aria-hidden="true">
                    {a.emoji}
                  </span>
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
        <CardFooter>
          <Button type="submit" size="lg" disabled={busy}>
            {COPY.start.submit}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
