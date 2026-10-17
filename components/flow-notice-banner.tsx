"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { sessionStore } from "@/components/session-store";
import type { FlowNotice } from "@/lib/flow/guard";

const AUTO_DISMISS_MS = 6000;

export function FlowNoticeBanner() {
  const pathname = usePathname();
  const [notice, setNotice] = useState<FlowNotice | null>(null);

  useEffect(() => {
    // 画面遷移時に保留されていたnoticeがあれば消費して表示
    const pending = sessionStore.consumeNotice();
    if (pending) {
      setNotice(pending);
    }
  }, [pathname]);

  useEffect(() => {
    // カスタムイベント経由の通知検知
    const handleNotice = (e: Event) => {
      const customEvent = e as CustomEvent<FlowNotice | null>;
      if (customEvent.detail) {
        setNotice(customEvent.detail);
      }
    };

    window.addEventListener("hidamari:notice", handleNotice);
    return () => {
      window.removeEventListener("hidamari:notice", handleNotice);
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 shadow-sm transition-all duration-300 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex items-center gap-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="leading-relaxed font-medium">{notice.message}</p>
      </div>
      <button
        type="button"
        onClick={() => setNotice(null)}
        className="shrink-0 rounded-lg p-1 text-amber-700/70 hover:bg-amber-100 hover:text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500/50 dark:text-amber-300/70 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
        aria-label="閉じる"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
