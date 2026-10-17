import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RoomPageProps {
  params: Promise<{ id: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-4">
      {/* ルーム専用ヘッダー（残り時間・退出・ブロック・通報を常に表示し1タップで実行可能にする枠） */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <Badge>P7</Badge>
          <span className="font-medium">ルーム ({id})</span>
          <span className="text-muted-foreground">残り 30:00</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/checkin">退出</Link>
          </Button>
          <Button variant="outline" size="sm" type="button">
            ブロック
          </Button>
          <Button variant="outline" size="sm" type="button">
            通報
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AIファシリテーター同席チャットルーム</CardTitle>
          <CardDescription>
            お互いの気持ちを否定せず、安心できるペースでお話ししましょう。いつでも1タップで退出できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>（Phase 5・6 でリアルタイムチャット、個人情報マスク、危機ブロック、AIファシリテーター介入を実装します）</p>
        </CardContent>
      </Card>
    </div>
  );
}
