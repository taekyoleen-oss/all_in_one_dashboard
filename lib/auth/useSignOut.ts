"use client";

/**
 * 로그아웃 공용 훅 — 계정 메뉴(좌하단 아바타)·설정>계정 탭·승인 대기 화면이 함께 쓴다.
 *
 *  순서가 중요하다: 세션이 사라지면 RLS 때문에 대기 중이던 upsert가 전부 실패하므로
 *  `onBeforeSignOut`(디바운스 저장 flush)을 **signOut 전에** await한다. flush가 실패해도
 *  로그아웃은 계속 진행한다(로그아웃을 막는 게 더 나쁘다).
 *
 *  이동은 router.replace + refresh — 전체 내비게이션이라 proxy가 다시 평가하고
 *  서버 상태도 깨끗해진다.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function useSignOut(onBeforeSignOut?: () => Promise<void> | void) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const signOut = React.useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onBeforeSignOut?.();
    } catch {
      /* best-effort */
    }
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [signingOut, onBeforeSignOut, router]);

  return { signOut, signingOut };
}
