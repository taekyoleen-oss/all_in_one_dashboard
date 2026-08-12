"use client";

/**
 * NoAccess — 로그인은 되어 있으나 승인 목록에 없는 세션에 보여주는 화면.
 *
 *  왜 리다이렉트가 아니라 화면인가: proxy는 "세션 있음 + /login" 이면 다시 `/`로
 *  보내므로, 여기서 /login으로 튕기면 무한 루프가 된다. 세션을 실제로 없애는
 *  **로그아웃이 유일한 출구**라서 버튼 하나만 둔다.
 *
 *  (관리자가 승인/차단을 바꾸면 auth 계정 자체가 정리되므로 보통은 이 화면 대신
 *   로그인 화면으로 떨어진다. 이 화면은 승인 취소 직후 남은 세션의 안전망이다.)
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/brand/BrandMark";

export function NoAccess({ email }: { email: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const signOut = React.useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [busy, router]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-[var(--radius)] border border-border bg-card p-6 text-center shadow-md sm:p-8">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <BrandMark height={26} />
        </div>
        <h1 className="mb-2 flex items-center justify-center gap-1.5 text-lg font-semibold text-foreground">
          <ShieldAlert size={18} className="text-destructive" />
          승인 대기 중
        </h1>
        <p className="text-sm text-muted-foreground">
          {email ? <span className="font-medium text-foreground">{email}</span> : "이 계정"} 은(는)
          아직 관리자 승인을 받지 않았습니다. 승인 후 다시 로그인해 주세요.
        </p>
        <button
          type="button"
          onClick={signOut}
          disabled={busy}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <LogOut size={16} />
          {busy ? "로그아웃 중…" : "로그아웃"}
        </button>
      </div>
    </main>
  );
}

export default NoAccess;
