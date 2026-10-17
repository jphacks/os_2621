import Link from "next/link";
import { HeartHandshake, Settings, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { id: "P0", label: "トップ", href: "/" },
  { id: "P1", label: "はじめる", href: "/start" },
  { id: "P2", label: "気分", href: "/checkin" },
  { id: "P3", label: "AI相談", href: "/consult" },
  { id: "P4", label: "要約確認", href: "/summary" },
  { id: "P5", label: "候補", href: "/candidates" },
  { id: "P6", label: "リクエスト", href: "/requests" },
  { id: "P7", label: "ルーム", href: "/rooms/demo" },
  { id: "P8", label: "窓口案内", href: "/crisis" },
  { id: "P9", label: "設定", href: "/settings" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2.5">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 min-h-[44px]"
        >
          <Sun className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>ひだまり</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm" className="min-h-[44px]">
            <Link href="/crisis">
              <HeartHandshake className="h-4 w-4" aria-hidden="true" />
              <span>困ったときは</span>
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="設定"
          >
            <Link href="/settings">
              <Settings className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {/* 開発・デモ確認用の画面遷移バー（P0〜P9すべてに1クリックで遷移可能） */}
      <nav
        aria-label="画面一覧ナビゲーション"
        className="border-t bg-muted/40 px-4 py-1.5 overflow-x-auto"
      >
        <ul className="mx-auto flex max-w-3xl items-center gap-1.5 text-xs whitespace-nowrap">
          {NAV_LINKS.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span className="font-mono text-[11px] opacity-75">
                  {item.id}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
