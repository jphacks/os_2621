"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sessionStore } from "@/components/session-store";
import { evaluateFlowAccess } from "@/lib/flow/guard";

type ServerMeState = {
  profile: { nickname: string; avatar: string; age_group?: string } | null;
  checkin: { mood: number; energy: number } | null;
  summaryShared: boolean;
  summaryText: string | null;
  joinedRoomIds: string[];
  activeRoomId?: string | null;
  isCrisis: boolean;
  isMatchingBlocked: boolean;
};

let hasCheckedAutoRoomThisTab = false;

export function FlowGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      // タブを閉じてブラウザを再度開いた際（初回マウント時）、人間との進行中チャット（activeRoomId）があれば自動でそのルーム画面を開く
      if (!hasCheckedAutoRoomThisTab) {
        hasCheckedAutoRoomThisTab = true;
        const alreadyCheckedInTab = (() => {
          try {
            const v = window.sessionStorage?.getItem("hidamari.autoRoomChecked") === "1";
            window.sessionStorage?.setItem("hidamari.autoRoomChecked", "1");
            return v;
          } catch {
            return false;
          }
        })();

        if (!alreadyCheckedInTab && !pathname.startsWith("/rooms/") && pathname !== "/crisis") {
          const localFlags = sessionStore.getFlags();
          const localActiveRoomId = sessionStore.getActiveRoomId();
          if (localActiveRoomId && !localFlags.crisis && !localFlags.matchingBlocked) {
            try {
              window.sessionStorage?.setItem("hidamari.homeAutoRoomOpened", "1");
            } catch {
              // noop
            }
            setBlocked(true);
            router.replace(`/rooms/${localActiveRoomId}`);
            return;
          }
          // 相手がリクエストを承諾してルームが作られていた場合や、localStorage に activeRoomId が残っていなかった場合も /api/me から確認して自動で開く
          try {
            const res = await fetch("/api/me");
            if (res.ok) {
              const me = (await res.json()) as ServerMeState;
              if (me.profile && !sessionStore.getProfile()) {
                sessionStore.setProfile(me.profile);
              }
              if (me.checkin && !sessionStore.getCheckin()) {
                sessionStore.setCheckin(me.checkin);
              }
              if (me.summaryShared) {
                sessionStore.setSummaryShared(true);
                if (!sessionStore.getFlowState().hasMessages && me.summaryText) {
                  sessionStore.setMessages([{ role: "user", content: me.summaryText }]);
                }
              }
              if (Array.isArray(me.joinedRoomIds)) {
                me.joinedRoomIds.forEach((id) => sessionStore.addJoinedRoomId(id));
              }
              sessionStore.setActiveRoomId(me.activeRoomId ?? null);
              if (me.isCrisis || me.isMatchingBlocked) {
                sessionStore.setFlags({ crisis: me.isCrisis, matchingBlocked: me.isMatchingBlocked });
              }
              if (!cancelled && me.activeRoomId && !me.isCrisis && !me.isMatchingBlocked) {
                try {
                  window.sessionStorage?.setItem("hidamari.homeAutoRoomOpened", "1");
                } catch {
                  // noop
                }
                setBlocked(true);
                router.replace(`/rooms/${me.activeRoomId}`);
                return;
              }
            }
          } catch {
            // noop
          }
        }
      }

      const state = sessionStore.getFlowState();
      const result = evaluateFlowAccess(pathname, state);
      if (result.allowed) {
        setBlocked(false);
        return;
      }

      // すでにクライアント側で危機・マッチングブロックが確定している場合は即座にリダイレクト
      if (result.notice.code === "crisis_redirect" || result.notice.code === "matching_blocked") {
        setBlocked(true);
        sessionStore.setNotice(result.notice);
        router.replace(result.redirectPath);
        return;
      }

      // 別タブや再チェックイン等で sessionStorage / localStorage が空でも、サーバー（DB）に有効なプロフィール・要約・参加ルームがあれば復元する
      setBlocked(true);
      try {
        const res = await fetch("/api/me");
        if (res.ok) {
          const me = (await res.json()) as ServerMeState;
          if (me.profile && !sessionStore.getProfile()) {
            sessionStore.setProfile(me.profile);
          }
          if (me.checkin && !sessionStore.getCheckin()) {
            sessionStore.setCheckin(me.checkin);
          }
          if (me.summaryShared) {
            sessionStore.setSummaryShared(true);
            if (!sessionStore.getFlowState().hasMessages && me.summaryText) {
              sessionStore.setMessages([{ role: "user", content: me.summaryText }]);
            }
          }
          if (Array.isArray(me.joinedRoomIds)) {
            me.joinedRoomIds.forEach((id) => sessionStore.addJoinedRoomId(id));
          }
          if (me.activeRoomId !== undefined) {
            sessionStore.setActiveRoomId(me.activeRoomId ?? null);
          }
          if (me.isCrisis || me.isMatchingBlocked) {
            sessionStore.setFlags({ crisis: me.isCrisis, matchingBlocked: me.isMatchingBlocked });
          }

          if (cancelled) return;
          const recheck = evaluateFlowAccess(pathname, sessionStore.getFlowState());
          if (recheck.allowed) {
            setBlocked(false);
            return;
          }
          sessionStore.setNotice(recheck.notice);
          router.replace(recheck.redirectPath);
          return;
        }
      } catch {
        // 通信失敗時はローカル判定に従う
      }

      if (cancelled) return;
      sessionStore.setNotice(result.notice);
      router.replace(result.redirectPath);
    }

    void checkAccess();
    return () => {
      cancelled = true;
    };
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
