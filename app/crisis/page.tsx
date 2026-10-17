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
import { COPY } from "@/lib/copy";

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
          <CardTitle>{COPY.crisis.title}</CardTitle>
          <CardDescription>{COPY.crisis.lead}</CardDescription>
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
            <p className="font-medium">{COPY.crisis.guideTitle}</p>
            <p className="text-muted-foreground">{COPY.crisis.guide}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/consult">{COPY.crisis.back}</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">{COPY.crisis.top}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
