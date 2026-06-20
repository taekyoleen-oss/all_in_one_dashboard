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
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
}

/** Derive a 1-char avatar glyph from the email (fallends back to "N"). */
function initialOf(email: string | null): string {
  const c = email?.trim()?.[0];
  return c ? c.toUpperCase() : "N";
}

export function AccountMenu({ email }: AccountMenuProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleSignOut = React.useCallback(
    async (e: React.MouseEvent) => {
      // Keep the menu logic from auto-closing before the async work resolves.
      e.preventDefault();
      if (signingOut) return;
      setSigningOut(true);
      const supabase = createClient();
      await supabase.auth.signOut();
      // Full navigation so the proxy re-evaluates and server state is clean.
      router.replace("/login");
      router.refresh();
    },
    [router, signingOut],
  );

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <button
            type="button"
            aria-label="계정 메뉴"
            title={email ?? "계정"}
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
              <p className="text-[11px] text-muted-foreground">소유자 계정</p>
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
