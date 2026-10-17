import { COPY } from "@/lib/copy";

export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p
      role="note"
      className={`rounded-lg border bg-secondary/40 px-4 py-2 text-xs text-muted-foreground ${className}`}
    >
      {COPY.disclaimer}
    </p>
  );
}
