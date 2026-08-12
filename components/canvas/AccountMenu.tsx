"use client";

/**
 * ============================================================================
 *  AccountMenu — the bottom-left avatar turned into an account control
 * ============================================================================
 *
 *  Replaces the static "N" avatar that used to sit bottom-left of the canvas.
 *  Shows the signed-in owner's email and a 로그아웃 action that calls
 *  `supabase.auth.signOut()` (clears the auth cookies) then routes to /login.
 *
 *  Client Component: uses the browser Supabase client + router. The signed-in
 *  email is passed down from the Server Component (page.tsx) which read it from
 *  the verified session — we don't re-fetch it here.
 * ============================================================================
 */

import * as React from "react";
import { LogOut, User } from "lucide-react";
import { useSignOut } from "@/lib/auth/useSignOut";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/primitives";

export interface AccountMenuProps {
  /** Signed-in owner email (from the verified server session). */
  email: string | null;
  /**
   * 로그아웃 직전에 await되는 훅 — 디바운스 저장 큐를 flush한다. 세션이 사라진 뒤엔
   * RLS 때문에 대기 중이던 upsert가 실패하므로 signOut 전에 완료돼야 한다.
   */
  onBeforeSignOut?: () => Promise<void> | void;
}

/**
 * Derive a 1-char avatar glyph from the email (falls back to "N").
 * 설정>계정의 안내 문구가 같은 글자를 인용하므로 export한다(규칙이 한 곳에만 있게).
 */
export function initialOf(email: string | null): string {
  const c = email?.trim()?.[0];
  return c ? c.toUpperCase() : "N";
}

export function AccountMenu({ email, onBeforeSignOut }: AccountMenuProps) {
  const { signOut, signingOut } = useSignOut(onBeforeSignOut);

  const handleSignOut = React.useCallback(
    (e: React.MouseEvent) => {
      // Keep the menu logic from auto-closing before the async work resolves.
      e.preventDefault();
      void signOut();
    },
    [signOut],
  );

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button
            type="button"
            aria-label="계정 메뉴 (로그아웃)"
            // 아바타만으로는 로그아웃 위치를 못 찾는다는 피드백 → 툴팁에 명시.
            title={`${email ?? "계정"} · 클릭하면 로그아웃`}
            className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold text-foreground shadow-md outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {initialOf(email)}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <User size={14} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {email ?? "로그인됨"}
              </p>
              <p className="text-[11px] text-muted-foreground">로그인된 계정</p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            destructive
            icon={<LogOut size={14} />}
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut ? "로그아웃 중…" : "로그아웃"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default AccountMenu;
