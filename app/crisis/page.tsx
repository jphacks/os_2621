import Link from "next/link";
import { HotlineList } from "@/components/hotline-list";
import { BreatheGuide } from "@/components/breathe-guide";
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
      <Card className="border-destructive/40 shadow-hidamari">
        <CardHeader>
          <CardTitle>{COPY.crisis.title}</CardTitle>
          <CardDescription className="leading-relaxed">{COPY.crisis.lead}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <BreatheGuide autoStart={true} />

          <HotlineList tone="crisis" />

          <div className="rounded-lg border bg-secondary/50 p-4 text-sm space-y-1">
            <p className="font-medium">{COPY.crisis.guideTitle}</p>
            <p className="text-muted-foreground leading-relaxed">{COPY.crisis.guide}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link href="/consult">{COPY.crisis.back}</Link>
          </Button>
          <Button asChild variant="ghost" className="min-h-[44px]">
            <Link href="/">{COPY.crisis.top}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
