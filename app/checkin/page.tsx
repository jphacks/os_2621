"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { COPY } from "@/lib/copy";
import { sessionStore } from "@/components/session-store";

function ScaleInput({
  id,
  label,
  value,
  onChange,
  scale,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  scale: readonly string[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {value}／5 {scale[value - 1]}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full cursor-pointer accent-[hsl(var(--primary))]"
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{scale[0]}</span>
        <span>{scale[4]}</span>
      </div>
    </div>
  );
}

// P2 気分チェックイン
export default function CheckinPage() {
  const router = useRouter();
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    sessionStore.setCheckin({ mood, energy });
    // 新しい相談セッションの開始。前回の危機フラグなどは引き継がない
    sessionStore.clearConsult();
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, energy }),
      });
      if (!res.ok) throw new Error("checkin failed");
    } catch {
      // 保存に失敗しても相談は続けられる（localの値は残してある）
      setNotice(COPY.checkin.savingError);
      await new Promise((r) => setTimeout(r, 1200));
    }
    router.push("/consult");
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{COPY.checkin.title}</CardTitle>
          <CardDescription>{COPY.checkin.lead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <ScaleInput id="mood" label={COPY.checkin.moodLabel} value={mood} onChange={setMood} scale={COPY.checkin.moodScale} />
          <ScaleInput id="energy" label={COPY.checkin.energyLabel} value={energy} onChange={setEnergy} scale={COPY.checkin.energyScale} />
          {notice && (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" size="lg" disabled={busy}>
            {COPY.checkin.submit}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
