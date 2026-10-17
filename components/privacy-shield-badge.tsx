"use client";

import { ShieldCheck, Lock, Clock, EyeOff } from "lucide-react";

interface PrivacyShieldBadgeProps {
  variant?: "badge" | "card";
  className?: string;
}

/**
 * ユーザーのプライバシー・安全保証バッジ/カード。
 * 「相手にはこの要約文だけが見える」「AIとの会話全文は保存・公開されない」「24時間で自動消去」
 * を視覚的に伝え、安心感を提供する。
 */
export function PrivacyShieldBadge({
  variant = "card",
  className = "",
}: PrivacyShieldBadgeProps) {
  if (variant === "badge") {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-sage-300/80 bg-sage-50/80 px-3 py-1 text-xs text-sage-800 dark:border-sage-700/80 dark:bg-sage-950/40 dark:text-sage-200 ${className}`}
      >
        <ShieldCheck className="h-3.5 w-3.5 text-sage-600 dark:text-sage-400" aria-hidden="true" />
        <span className="font-medium">会話の秘密は厳格に守られます（全文非公開・24時間で消去）</span>
      </div>
    );
  }

  return (
    <div
      role="note"
      aria-label="プライバシーと安全の保証"
      className={`rounded-xl border border-sage-200/90 bg-gradient-to-br from-sage-50/60 to-warmth-50/40 p-4 text-xs text-foreground shadow-hidamari-soft dark:border-sage-900 dark:from-sage-950/30 dark:to-background ${className}`}
    >
      <div className="mb-2.5 flex items-center gap-2 font-semibold text-sage-900 dark:text-sage-100">
        <ShieldCheck className="h-4 w-4 text-sage-600 dark:text-sage-400" aria-hidden="true" />
        <span>安心してお使いいただくための3つのプライバシー保証</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="flex items-start gap-2 rounded-lg bg-background/80 p-2.5 border border-border/40">
          <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">要約文だけを共有</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              マッチング相手にはあなたが同意したこの要約文のみが表示されます。
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-background/80 p-2.5 border border-border/40">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">会話全文は非公開</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              AIとの相談メッセージ全文はデータベースに保存されず、誰にも公開されません。
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-background/80 p-2.5 border border-border/40">
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">24時間で自動消去</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              共有された要約と候補情報は、作成から24時間後に自動的に安全に消去されます。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
