"use client";

import Link from "next/link";
import { useState } from "react";
import { Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { COPY } from "@/lib/copy";

// P0 トップ / 利用上の注意
export default function TopPage() {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="space-y-6">
      <Card className="shadow-hidamari border-warmth-200/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sun className="h-6 w-6 text-primary animate-breathe-pulse" aria-hidden="true" />
            <CardTitle className="text-xl">{COPY.appName}へようこそ</CardTitle>
          </div>
          <CardDescription className="leading-relaxed">{COPY.top.lead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm leading-relaxed">
          <ul className="space-y-2">
            {COPY.top.points.map((p) => (
              <li key={p} className="flex gap-2">
                <span aria-hidden="true">🌱</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-2 rounded-xl border border-warmth-200/70 bg-warmth-50/50 p-4">
            <p className="font-medium text-warmth-900">ご利用にあたっての大切なお願い</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {COPY.top.notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-background/60 p-3 hover:bg-warmth-50/50 transition-colors">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-5 w-5 accent-[hsl(var(--primary))]"
            />
            <span className="font-medium">{COPY.top.consent}</span>
          </label>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          {agreed ? (
            <Button asChild size="lg" className="min-h-[44px] shadow-sm">
              <Link href="/start">{COPY.top.start}</Link>
            </Button>
          ) : (
            <Button size="lg" disabled className="min-h-[44px]">
              {COPY.top.start}
            </Button>
          )}
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link href="/crisis">相談窓口を見る</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
