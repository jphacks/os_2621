"use client";

import { Sparkles } from "lucide-react";

interface BreathingIndicatorProps {
  label?: string;
  className?: string;
}

/**
 * AI傾聴チャット等で、応答生成中に4秒周期で柔らかく呼吸する安心インジケーター。
 */
export function BreathingIndicator({
  label = "AIがあなたの言葉を優しく受け止めています…",
  className = "",
}: BreathingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2.5 rounded-full border border-warmth-200/80 bg-warmth-50/90 px-4 py-2 text-xs text-warmth-900 shadow-hidamari-soft backdrop-blur-sm ${className}`}
    >
      <div className="relative flex h-3.5 w-3.5 items-center justify-center">
        {/* 呼吸するオーラリング（4秒周期） */}
        <span
          className="absolute inline-flex h-full w-full rounded-full bg-warmth-400 opacity-60 animate-breathe"
          aria-hidden="true"
        />
        {/* 中心コア */}
        <span
          className="relative inline-flex h-2 w-2 rounded-full bg-warmth-600"
          aria-hidden="true"
        />
      </div>
      <Sparkles className="h-3.5 w-3.5 text-warmth-600 animate-breathe-pulse" aria-hidden="true" />
      <span className="font-medium tracking-wide animate-breathe-pulse">{label}</span>
    </div>
  );
}
