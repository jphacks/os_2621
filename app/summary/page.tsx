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

export default function SummaryPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>P4</Badge>
            <CardTitle>要約の確認・編集</CardTitle>
          </div>
          <CardDescription>
            相手にはこの文だけが表示されます。内容は自由に書き換えられます。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>（Phase 3 で要約・カテゴリ・タグの確認・編集と共有同意を実装します）</p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/candidates">この内容で共有する（P5へ）</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/consult">共有しない（P3へ戻る）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
