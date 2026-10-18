import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOTLINES } from "@/lib/safety/hotlines";

// 窓口の一覧は lib/safety/hotlines.ts が正。番号・受付時間は公開前に公式サイトで確認すること。
// 赤い警告色は危機対応画面（tone="crisis"）だけで使う
export function HotlineList({ tone = "calm" }: { tone?: "crisis" | "calm" }) {
  return (
    <div className="grid gap-3">
      {HOTLINES.map((item) => {
        const tel = item.phone.replace(/[^0-9+*#]/g, "");
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.hours}
                {item.cost ? `・${item.cost}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Button
              asChild
              variant={tone === "crisis" ? "destructive" : "secondary"}
              size="sm"
            >
              <a href={`tel:${tel}`}>
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
                <span>{item.phone}</span>
              </a>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
