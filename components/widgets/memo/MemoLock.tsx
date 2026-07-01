"use client";

/**
 * 메모 화면 잠금 — 개별 메모의 선택적 비밀번호(요구).
 *
 *  비밀번호(해시)가 있으면 타일 본문을 잠금 프롬프트로 가리고, 잠금 해제 후
 *  `lockAfterMin`이 지나면 자동으로 다시 잠근다(절대 타이머 — 금고·메모장과 동일).
 *  잠금 해제 상태는 인메모리라 리로드하면 다시 잠긴다. 화면 잠금만이며 본문 자체는
 *  config에 평문 저장된다(타입 주석 참고).
 */

import * as React from "react";
import { Lock } from "lucide-react";
import { hashPassword, type MemoConfig } from "./types";

export function useMemoLock(config: MemoConfig): {
  locked: boolean;
  /** 비밀번호(잠금)가 설정돼 있는지 — '지금 잠금' 버튼 노출 판단용. */
  hasLock: boolean;
  /** 즉시 잠금(요구: 해제 상태에서 상단 버튼으로 바로 잠금). */
  lock: () => void;
  tryUnlock: (pw: string) => Promise<boolean>;
} {
  const hasLock = !!config.pwHash;
  const [unlocked, setUnlocked] = React.useState(!hasLock);

  // 비번 설정/해제(config.pwHash 변화) 시 렌더 중 잠금 상태 동기화(효과 없이).
  const [seen, setSeen] = React.useState(hasLock);
  if (seen !== hasLock) {
    setSeen(hasLock);
    setUnlocked(!hasLock);
  }

  const relockMs = Math.max(1, config.lockAfterMin || 5) * 60_000;
  const timer = React.useRef<number | null>(null);
  const arm = React.useCallback(() => {
    if (!hasLock) return;
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setUnlocked(false), relockMs);
  }, [hasLock, relockMs]);
  React.useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  const tryUnlock = React.useCallback(
    async (pw: string): Promise<boolean> => {
      const h = await hashPassword(pw);
      if (h && h === config.pwHash) {
        setUnlocked(true);
        arm();
        return true;
      }
      return false;
    },
    [config.pwHash, arm],
  );

  const lock = React.useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    setUnlocked(false);
  }, []);

  return { locked: hasLock && !unlocked, hasLock, lock, tryUnlock };
}

export function MemoLockPrompt({
  tryUnlock,
  size = "compact",
}: {
  tryUnlock: (pw: string) => Promise<boolean>;
  size?: "compact" | "expanded";
}) {
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await tryUnlock(pw);
    if (ok) {
      setPw("");
      setErr(false);
    } else {
      setErr(true);
    }
  };

  return (
    <form
      onSubmit={submit}
      data-pb-no-drag=""
      className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center"
    >
      <Lock
        size={size === "expanded" ? 28 : 22}
        aria-hidden
        className="text-muted-foreground"
      />
      <p className="text-xs text-muted-foreground">
        잠긴 메모입니다. 비밀번호를 입력하세요.
      </p>
      <input
        type="password"
        value={pw}
        onChange={(e) => {
          setPw(e.target.value);
          setErr(false);
        }}
        autoComplete="off"
        placeholder="비밀번호"
        className="w-full max-w-44 rounded-md border border-border bg-background px-2 py-1.5 text-center text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {err ? (
        <p className="text-[11px] text-destructive">비밀번호가 틀렸습니다.</p>
      ) : null}
      <button
        type="submit"
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        잠금 해제
      </button>
    </form>
  );
}
