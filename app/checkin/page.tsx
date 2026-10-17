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

export default function CheckinPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>P2</Badge>
            <CardTitle>気分チェックイン</CardTitle>
          </div>
          <CardDescription>
            今の気分とエネルギーの度合い（1〜5）を教えてください。無理のないペースでお話ししましょう。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>（Phase 2 で気分・エネルギースライダー（1〜5）を実装します）</p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button asChild>
            <Link href="/consult">AI相談へ進む（P3へ）</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/start">戻る（P1）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
