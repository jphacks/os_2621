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

export default function TopPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge>P0</Badge>
            <CardTitle>ひだまりへようこそ（トップ / 利用上の注意）</CardTitle>
          </div>
          <CardDescription>
            AIに今の気持ちを話し、あなたの意思で同じ悩みを持つ仲間と安全につながれる場所です。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <div className="rounded-lg border bg-secondary/50 p-4 space-y-2">
            <p className="font-medium">ご利用にあたっての大切なお願い</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>
                AIや仲間は専門家の代わりではありません（医療的な診断や治療は行いません）。
              </li>
              <li>
                本名・連絡先・SNSアカウントなどの個人情報は入力・交換しないでください。
              </li>
              <li>
                緊急の危険がある場合は、110番・119番または専門の相談窓口へご連絡ください。
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/start">同意してはじめる（P1へ）</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/crisis">相談窓口を見る（P8へ）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
