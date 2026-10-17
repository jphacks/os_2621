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

export default function CandidatesPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>P5</Badge>
            <CardTitle>似た悩みを持つ候補一覧</CardTitle>
          </div>
          <CardDescription>
            同じような気持ちを抱えている候補（最大3件）と共通点を表示します。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>（Phase 4 でタグスコアによる候補抽出と「つながりをお願いする」リクエスト送信を実装します）</p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/requests">リクエスト状況を見る（P6へ）</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/summary">要約確認に戻る（P4）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
