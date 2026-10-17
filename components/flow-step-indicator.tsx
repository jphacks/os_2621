"use client";

import { usePathname } from "next/navigation";
import { normalizePathname } from "@/lib/flow/guard";

const STEPS = [
  { path: "/start", step: 1, label: "プロフィール" },
  { path: "/checkin", step: 2, label: "今の調子" },
  { path: "/consult", step: 3, label: "AIとお話し" },
  { path: "/summary", step: 4, label: "話の整理" },
  { path: "/candidates", step: 5, label: "似た悩みを持つ人" },
  { path: "/requests", step: 6, label: "リクエスト" },
] as const;

export function FlowStepIndicator() {
  const rawPath = usePathname();
  const currentPath = normalizePathname(rawPath);

  const matched = STEPS.find((s) => s.path === currentPath);
  if (!matched) return null;

  return (
    <nav
      aria-label="進捗状況"
      className="mb-4 flex items-center justify-between text-xs text-muted-foreground"
    >
      <div className="flex items-center gap-1.5 font-medium">
        <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
          Step {matched.step} / {STEPS.length}
        </span>
        <span>{matched.label}</span>
      </div>

      <div className="flex items-center gap-1" aria-hidden="true">
        {STEPS.map((s) => (
          <div
            key={s.path}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              s.step === matched.step
                ? "w-6 bg-primary"
                : s.step < matched.step
                  ? "w-2 bg-primary/40"
                  : "w-2 bg-muted-foreground/20"
            }`}
          />
        ))}
      </div>
    </nav>
  );
}
