import Link from "next/link";
import { PhoneCall } from "lucide-react";
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

const HOTLINES_PREVIEW = [
  {
    name: "緊急時（警察・救急）",
    number: "110 / 119",
    tel: "110",
    note: "今すぐ命の危険があるとき",
  },
  {
    name: "よりそいホットライン",
    number: "0120-279-338",
    tel: "0120279338",
    note: "24時間・通話料無料",
  },
  {
    name: "#いのちSOS",
    number: "0120-061-338",
    tel: "0120061338",
    note: "通話料無料",
  },
  {
    name: "いのちの電話（ナビダイヤル）",
    number: "0570-783-556",
    tel: "0570783556",
    note: "午前10時〜午後10時",
  },
] as const;

export default function CrisisPage() {
  return (
    <div className="space-y-6">
      <Card className="border-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-destructive text-destructive-foreground">
              P8
            </Badge>
            <CardTitle>今すぐ相談できる専門窓口（困ったときは）</CardTitle>
          </div>
          <CardDescription>
            ひとりで抱え込まず、専門の相談員に今の気持ちを話してみませんか。AIや仲間は専門家の代わりではありません。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {HOTLINES_PREVIEW.map((item) => (
              <div
                key={item.name}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4"
              >
                <div>
                  <p className="font-medium text-sm">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.note}</p>
                </div>
                <Button asChild variant="destructive" size="sm">
                  <a href={`tel:${item.tel}`}>
                    <PhoneCall className="h-4 w-4" aria-hidden="true" />
                    <span>{item.number}</span>
                  </a>
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-lg border bg-secondary/50 p-4 text-sm space-y-1">
            <p className="font-medium">少しだけ呼吸を整えるガイド</p>
            <p className="text-muted-foreground">
              まずは足の裏が床についている感覚を確かめて、4秒かけて鼻から息を吸い、6秒かけてゆっくり吐き出してみましょう。
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/consult">AI相談に戻る（P3）</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">トップへ戻る（P0）</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
