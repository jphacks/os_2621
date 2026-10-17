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

export default function ConsultPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-secondary/40 px-4 py-2 text-xs text-muted-foreground">
        ※ AIや仲間は専門家の代わりではありません。つらいときはいつでも右上の「困ったときは」から相談窓口を確認できます。
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>P3</Badge>
            <CardTitle>AI相談チャット</CardTitle>
          </div>
          <CardDescription>
            いま感じていることやモヤモヤしていることを、自分のペースで話してみてください。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>（Phase 2 でストリーミングAI傾聴チャットと二重危機検知を実装します）</p>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/summary">話を整理する（P4へ）</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/checkin">気分チェックインに戻る（P2）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
