"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { COPY } from "@/lib/copy";
import { ScaleInput } from "@/components/scale-input";
import { sessionStore } from "@/components/session-store";

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
      <Card className="shadow-hidamari">
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
          <Button type="submit" size="lg" disabled={busy} className="min-h-[44px]">
            {COPY.checkin.submit}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
