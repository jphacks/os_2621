"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sessionStore } from "@/components/session-store";
import { evaluateFlowAccess } from "@/lib/flow/guard";

export function FlowGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const state = sessionStore.getFlowState();
    const result = evaluateFlowAccess(pathname, state);
    if (!result.allowed) {
      setBlocked(true);
      sessionStore.setNotice(result.notice);
      router.replace(result.redirectPath);
    } else {
      setBlocked(false);
    }
  }, [pathname, router]);

  if (blocked) {
    return (
      <div
        role="status"
        className="py-16 text-center text-sm text-muted-foreground animate-pulse"
      >
        画面を切り替えています…
      </div>
    );
  }

  return <>{children}</>;
}
