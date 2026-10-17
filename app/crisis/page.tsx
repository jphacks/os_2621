import Link from "next/link";
import { HotlineList } from "@/components/hotline-list";
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

export default function CrisisPage() {
  return (
    <div className="space-y-6">
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>{COPY.crisis.title}</CardTitle>
          <CardDescription>{COPY.crisis.lead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <HotlineList tone="crisis" />

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
