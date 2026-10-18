"use client";

import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BreatheGuideProps {
  autoStart?: boolean;
  className?: string;
}

type Phase = "inhale" | "hold" | "exhale";

const PHASES: Record<Phase, { text: string; subtext: string; duration: number }> = {
  inhale: {
    text: "息を吸って…",
    subtext: "鼻からゆっくり、お腹に空気を満たすように",
    duration: 4,
  },
  hold: {
    text: "息を止めて…",
    subtext: "肩の力を抜いて、今の感覚を感じて",
    duration: 4,
  },
  exhale: {
    text: "ゆっくり吐いて…",
    subtext: "口から細く長く、不安や緊張を吐き出すように",
    duration: 6,
  },
};

/**
 * 4秒吸う → 4秒止める → 6秒吐く グラウンディング呼吸ガイド。
 * 窓口案内（/crisis）やルーム終了後の振り返りで使用可能。
 */
export function BreatheGuide({ autoStart = true, className = "" }: BreatheGuideProps) {
  const [isActive, setIsActive] = useState(autoStart);
  const [phase, setPhase] = useState<Phase>("inhale");
  const [secondsLeft, setSecondsLeft] = useState(PHASES.inhale.duration);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) {
          return prev - 1;
        }

        // 次のフェーズへ移行
        if (phase === "inhale") {
          setPhase("hold");
          return PHASES.hold.duration;
        } else if (phase === "hold") {
          setPhase("exhale");
          return PHASES.exhale.duration;
        } else {
          setPhase("inhale");
          return PHASES.inhale.duration;
        }
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, phase]);

  function handleReset() {
    setIsActive(false);
    setPhase("inhale");
    setSecondsLeft(PHASES.inhale.duration);
  }

  // 円のスケールとスタイル
  const circleScale =
    phase === "inhale"
      ? "scale-110 bg-warmth-200/90 shadow-hidamari-glow"
      : phase === "hold"
      ? "scale-110 bg-sage-200/90 shadow-hidamari"
      : "scale-90 bg-warmth-100/70";

  return (
    <div
      role="region"
      aria-label="グラウンディング呼吸ガイド"
      className={`rounded-2xl border border-warmth-200/70 bg-gradient-to-b from-warmth-50/70 to-card p-5 text-center shadow-hidamari-soft ${className}`}
    >
      <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-medium text-warmth-700">
        <Wind className="h-4 w-4" aria-hidden="true" />
        <span>グラウンディング呼吸法（深呼吸で心を整える）</span>
      </div>

      {/* 呼吸アニメーションサークル */}
      <div className="relative my-6 flex h-40 items-center justify-center">
        {/* 背景の柔らかな波紋 */}
        <div
          className={`absolute h-36 w-36 rounded-full transition-all duration-1000 ease-in-out ${circleScale}`}
          aria-hidden="true"
        />
        {/* 内側の円 */}
        <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border border-warmth-300/80 bg-background/90 shadow-sm backdrop-blur-sm">
          <span className="font-mono text-2xl font-semibold text-primary">{secondsLeft}</span>
          <span className="text-[11px] text-muted-foreground">秒</span>
        </div>
      </div>

      {/* ガイダンステキスト */}
      <div className="min-h-[3.5rem] space-y-1">
        <p className="text-base font-semibold text-foreground transition-all duration-500">
          {PHASES[phase].text}
        </p>
        <p className="text-xs text-muted-foreground">{PHASES[phase].subtext}</p>
      </div>

      {/* 操作ボタン */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setIsActive((v) => !v)}
          className="min-h-[40px] px-4 font-normal"
        >
          {isActive ? (
            <>
              <Pause className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              一時停止
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {secondsLeft === PHASES.inhale.duration && phase === "inhale" ? "呼吸をはじめる" : "再開する"}
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleReset}
          className="min-h-[40px] text-muted-foreground"
          aria-label="呼吸ガイドをリセット"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
