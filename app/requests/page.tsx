import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RequestsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>P6</Badge>
            <CardTitle>つながりリクエスト</CardTitle>
          </div>
          <CardDescription>
            届いたリクエスト（承諾 / 見送り）と、送ったリクエストの状態を確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>（Phase 4 で双方の同意によるルーム作成と Realtime 通知を実装します）</p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/rooms/demo">チャットルームへ進む（P7へ）</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/candidates">候補一覧に戻る（P5）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
