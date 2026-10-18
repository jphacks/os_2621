"use client";

import { useState } from "react";
import { Mic, MicOff, Phone, PhoneCall, PhoneOff, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/copy";
import type { CallState } from "@/lib/webrtc/callStateMachine";

interface CallPanelProps {
  state: CallState;
  formattedDuration: string;
  partnerNickname: string;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

export function CallPanel({
  state,
  formattedDuration,
  partnerNickname,
  onAccept,
  onReject,
  onCancel,
  onEnd,
  onToggleMute,
}: CallPanelProps) {
  const [errorDismissed, setErrorDismissed] = useState(false);

  // エラー時の通知
  const showError = !!state.errorMessage && !errorDismissed;

  return (
    <div className="space-y-2">
      {/* エラー案内（マイク権限など） */}
      {showError && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-xl border border-warmth-200 bg-warmth-50/90 p-3 text-xs text-foreground shadow-sm"
        >
          <span>{state.errorMessage}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setErrorDismissed(true)}
            aria-label="閉じる"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* 自分が通話リクエスト中 (requesting) */}
      {state.status === "requesting" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 text-sm shadow-sm transition-all animate-pulse">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <PhoneCall className="h-4 w-4 text-primary animate-bounce" />
            <span>{COPY.call.requestingBanner}</span>
          </div>
          <Button size="sm" variant="outline" onClick={onCancel}>
            {COPY.call.cancelRequest}
          </Button>
        </div>
      )}

      {/* 相手からのお誘い受信 (requested) */}
      {state.status === "requested" && (
        <div className="space-y-2.5 rounded-2xl border border-primary/30 bg-card p-4 shadow-hidamari transition-all">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <PhoneCall className="h-4 w-4 text-primary" />
            <span>{COPY.call.incomingBanner(partnerNickname)}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {COPY.call.incomingNote}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={onAccept} className="min-h-[38px]">
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              {COPY.call.accept}
            </Button>
            <Button size="sm" variant="outline" onClick={onReject} className="min-h-[38px]">
              {COPY.call.decline}
            </Button>
          </div>
        </div>
      )}

      {/* 接続中 (connecting) */}
      {state.status === "connecting" && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground shadow-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-primary animate-ping" />
          <span>{COPY.call.connecting}</span>
        </div>
      )}

      {/* 通話中 (connected) */}
      {state.status === "connected" && (
        <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-3.5 shadow-hidamari-soft dark:border-emerald-950/60 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 左側: 通話中表示 + タイマー */}
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {COPY.call.connectedTitle}
                </span>
                <span className="ml-2 font-mono text-sm font-medium text-foreground">
                  {formattedDuration}
                </span>
              </div>
            </div>

            {/* 右側: ミュート切替 & 1タップ切断ボタン */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={state.isMuted ? "destructive" : "outline"}
                onClick={onToggleMute}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                {state.isMuted ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" />
                    <span>{COPY.call.unmute}</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" />
                    <span>{COPY.call.mute}</span>
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onEnd}
                className="h-8 gap-1.5 px-3 text-xs"
              >
                <PhoneOff className="h-3.5 w-3.5" />
                <span>{COPY.call.end}</span>
              </Button>
            </div>
          </div>

          {/* 下部: AI見守り安心バッジ */}
          <div className="mt-2.5 flex items-center gap-1.5 border-t border-emerald-200/40 pt-2 text-[11px] text-muted-foreground dark:border-emerald-900/40">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>{COPY.call.aiWatching}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface CallPreConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CallPreConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: CallPreConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-hidamari space-y-4">
        <div className="flex items-center gap-2 text-primary font-semibold text-base" id="call-confirm-title">
          <Phone className="h-4 w-4" />
          <span>{COPY.call.modalTitle}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {COPY.call.modalDescription}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={() => {
              onClose();
              onConfirm();
            }}
            className="w-full min-h-[42px]"
          >
            <Phone className="mr-2 h-4 w-4" />
            {COPY.call.modalConfirm}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full min-h-[42px]"
          >
            {COPY.call.modalCancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
