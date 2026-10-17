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

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>P9</Badge>
            <CardTitle>設定・データの管理</CardTitle>
          </div>
          <CardDescription>
            ニックネームの変更、全データの削除、相談窓口の確認が行えます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>（Phase 7 でニックネーム変更と DELETE /api/me による全データ削除を実装します）</p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/crisis">相談窓口一覧を見る（P8）</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">トップへ戻る（P0）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
