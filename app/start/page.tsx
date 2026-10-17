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

export default function StartPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>P1</Badge>
            <CardTitle>はじめる（匿名プロフィール設定）</CardTitle>
          </div>
          <CardDescription>
            ニックネーム（2〜12文字）とアバターを選んで、匿名ではじめましょう。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>（Phase 1 で匿名サインインとニックネーム・アバター選択フォームを実装します）</p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button asChild>
            <Link href="/checkin">次へ：気分チェックイン（P2へ）</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">トップへ戻る（P0）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
