import { PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";

// TODO: Bさんの lib/safety/hotlines.ts ができたら、そちらを読み込む形に差し替える。
// 番号・受付時間は公開前に公式サイトで必ず確認すること（SPEC §5.3）。
const HOTLINES = [
  { name: "緊急時（警察・救急）", number: "110 / 119", tel: "110", note: "今すぐ命の危険があるとき" },
  { name: "よりそいホットライン", number: "0120-279-338", tel: "0120279338", note: "24時間・通話料無料" },
  { name: "#いのちSOS", number: "0120-061-338", tel: "0120061338", note: "通話料無料" },
  { name: "いのちの電話（ナビダイヤル）", number: "0570-783-556", tel: "0570783556", note: "午前10時〜午後10時" },
] as const;

// 赤い警告色は危機対応画面（tone="crisis"）だけで使う
export function HotlineList({ tone = "calm" }: { tone?: "crisis" | "calm" }) {
  return (
    <div className="grid gap-3">
      {HOTLINES.map((item) => (
        <div key={item.name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4">
          <div>
            <p className="text-sm font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.note}</p>
          </div>
          <Button asChild variant={tone === "crisis" ? "destructive" : "secondary"} size="sm">
            <a href={`tel:${item.tel}`}>
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              <span>{item.number}</span>
            </a>
          </Button>
        </div>
      ))}
    </div>
  );
}
