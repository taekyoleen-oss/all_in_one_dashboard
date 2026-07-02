"use client";

/**
 * ============================================================================
 *  SettingsDialog — 설정: 팔레트 앱 표시 + 계정(비밀번호 변경)
 * ============================================================================
 *
 *  Opened from the Toolbar gear (right of the theme toggle). Two tabs:
 *    • 앱 표시 — toggle which widget types appear in the palette (per-device,
 *      localStorage via useHiddenWidgets). Hiding never removes already-placed
 *      instances — only what you can ADD from the palette.
 *    • 계정   — show the signed-in email + change the account password via
 *      `supabase.auth.updateUser({ password })` (the app uses email+password auth).
 *
 *  Modal markup mirrors ConfigDialog (scrim + bottom-sheet on mobile, centered on
 *  desktop). Esc / scrim / ✕ close it.
 * ============================================================================
 */

import * as React from "react";
import { X, LayoutGrid, KeyRound, Eye, EyeOff, Check, AlertCircle, Loader2 } from "lucide-react";
import { IconButton } from "@/components/ui/primitives";
import { widgetRegistry } from "@/components/widgets/registry";
import { useHiddenWidgets } from "@/lib/utils/paletteVisibility";
import { createClient } from "@/lib/supabase/client";
import type { WidgetDefinition } from "@/lib/widgets/contract";

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Signed-in owner email (from the verified server session). */
  email: string | null;
}

type Tab = "apps" | "account";

export function SettingsDialog({ open, onClose, email }: SettingsDialogProps) {
  const [tab, setTab] = React.useState<Tab>("apps");

  // Esc to close.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 모달이 떠 있는 동안 배경 스크롤 잠금 — FocusOverlay/ConfigDialog와 동일 패턴.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="설정"
        className={[
          "relative z-10 flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card",
          "text-card-foreground shadow-2xl sm:rounded-2xl",
          "motion-safe:animate-[pb-sheet-up_220ms_ease-out] sm:motion-safe:animate-[pb-overlay-in_220ms_ease-out]",
        ].join(" ")}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">설정</h2>
          <IconButton label="닫기" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 border-b border-border px-3 py-2">
          <TabButton active={tab === "apps"} onClick={() => setTab("apps")}>
            <LayoutGrid size={14} aria-hidden /> 앱 표시
          </TabButton>
          <TabButton active={tab === "account"} onClick={() => setTab("account")}>
            <KeyRound size={14} aria-hidden /> 계정
          </TabButton>
        </div>

        {/* 모바일 바텀시트: safe-area 하단 패딩 + 스크롤 체이닝 차단. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {tab === "apps" ? <AppVisibility /> : <AccountSettings email={email} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/10 font-medium text-foreground"
          : "text-muted-foreground hover:bg-accent/40",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ------------------------------ 앱 표시 설정 ------------------------------ */

function AppVisibility() {
  const { hidden, setVisible, setHidden } = useHiddenWidgets();

  const defs = React.useMemo<WidgetDefinition[]>(
    () =>
      Object.values(widgetRegistry).sort((a, b) => {
        if (a.category !== b.category) return a.category === "core" ? -1 : 1;
        return a.displayName.localeCompare(b.displayName, "ko");
      }),
    [],
  );
  const shownCount = defs.length - hidden.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          팔레트에 표시할 앱을 선택하세요. (표시 {shownCount} / 전체 {defs.length})
        </p>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setHidden(new Set())}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            모두 표시
          </button>
          <button
            type="button"
            onClick={() => setHidden(new Set(defs.map((d) => d.type)))}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            모두 숨기기
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {defs.map((def) => {
          const Icon = typeof def.icon === "string" ? null : def.icon;
          const visible = !hidden.has(def.type);
          return (
            <li key={def.type}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-background/40 px-2.5 py-2 text-sm transition-colors hover:bg-accent/30">
                <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
                  {Icon ? <Icon size={16} /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {def.displayName}
                  {def.category === "core" ? (
                    <span className="ml-1.5 align-middle text-[10px] text-muted-foreground">
                      기본
                    </span>
                  ) : null}
                </span>
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(def.type, e.target.checked)}
                  className="size-4 shrink-0 accent-[var(--primary)]"
                  aria-label={`${def.displayName} 팔레트에 표시`}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        숨겨도 이미 보드에 추가한 위젯은 그대로 동작합니다. 이 설정은 이 기기에만 저장됩니다.
      </p>
    </div>
  );
}

/* -------------------------------- 계정 설정 ------------------------------- */

function AccountSettings({ email }: { email: string | null }) {
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [status, setStatus] = React.useState<"idle" | "working" | "ok" | "error">("idle");
  const [message, setMessage] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "working") return;
    setMessage(null);
    if (pw.length < 8) {
      setStatus("error");
      setMessage("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (pw !== pw2) {
      setStatus("error");
      setMessage("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setStatus("working");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setStatus("error");
        setMessage(error.message || "비밀번호 변경에 실패했습니다.");
        return;
      }
      setStatus("ok");
      setMessage("비밀번호가 변경되었습니다.");
      setPw("");
      setPw2("");
    } catch {
      setStatus("error");
      setMessage("비밀번호 변경 중 오류가 발생했습니다.");
    }
  };

  const inputCls =
    "w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <KeyRound size={14} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{email ?? "로그인됨"}</p>
          <p className="text-[11px] text-muted-foreground">소유자 계정 (이메일 + 비밀번호 로그인)</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-foreground">비밀번호 변경</h3>
        {/* Hidden username field for password-manager hygiene. */}
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email ?? ""}
          readOnly
          className="hidden"
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="new-pw" className="text-xs text-muted-foreground">
            새 비밀번호 (8자 이상)
          </label>
          <div className="relative">
            <input
              id="new-pw"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="새 비밀번호"
              className={inputCls}
            />
            <button
              type="button"
              aria-label={show ? "비밀번호 숨기기" : "비밀번호 표시"}
              onClick={() => setShow((s) => !s)}
              className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="new-pw2" className="text-xs text-muted-foreground">
            새 비밀번호 확인
          </label>
          <input
            id="new-pw2"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="새 비밀번호 다시 입력"
            className={inputCls}
          />
        </div>

        {message ? (
          <p
            className={[
              "flex items-center gap-1.5 text-xs",
              status === "ok" ? "text-positive" : "text-destructive",
            ].join(" ")}
          >
            {status === "ok" ? <Check size={14} /> : <AlertCircle size={14} />}
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "working" || !pw || !pw2}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          {status === "working" ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          비밀번호 변경
        </button>
      </form>
    </div>
  );
}

export default SettingsDialog;
