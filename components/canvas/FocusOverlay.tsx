"use client";

/**
 * ============================================================================
 *  FocusOverlay — 자세히 / 포커스 모드 (설계서 §6.3 ★ + §3)
 * ============================================================================
 *
 *  When `useBackStack.isOpen('focus:'+instanceId)` is true, render that
 *  instance's `registry[type].ExpandedView(config, instanceId)` full-screen.
 *
 *  Back-stack: the menu's 자세히 calls `openOverlay('focus:'+id)`, which pushes a
 *  real history entry, so hardware/gesture/PWA Back closes the focus overlay and
 *  KEEPS the app (§6.3). The X button calls `closeTop()` → same single pop path.
 *
 *  Motion (200–250ms enter/exit, respects prefers-reduced-motion): because the
 *  back-stack flips `isOpen` to false immediately on close, we keep the overlay
 *  mounted through a short "leaving" phase to play the exit animation, then
 *  unmount. Reduced-motion users skip the leaving phase (instant close).
 *
 *  This is a controlled, single-overlay component: the page renders ONE
 *  FocusOverlay and feeds it the currently-focused instance (top of stack).
 * ============================================================================
 */

import * as React from "react";
import { X } from "lucide-react";
import type { WidgetRegistry } from "@/lib/widgets/contract";
import type { WidgetInstance } from "@/components/canvas/GridCanvas";
import { FocusCloseProvider } from "@/lib/widgets/persistence";
import { IconButton } from "@/components/ui/primitives";

const DURATION_MS = 220;

export interface FocusOverlayProps {
  registry: WidgetRegistry;
  /** The focused instance, or null when nothing is focused. */
  instance: WidgetInstance | null;
  /** True while the focus overlay should be visible (top of back-stack). */
  open: boolean;
  /** Close (routes through history.back via useBackStack.closeTop). */
  onClose: () => void;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

export function FocusOverlay({
  registry,
  instance,
  open,
  onClose,
}: FocusOverlayProps) {
  // The parent keeps passing the focused `instance` (resolved from a persisted
  // focusId) even while closing, so the exit animation always has content — no
  // last-instance ref needed. Visibility is the back-stack `open` flag.
  const visible = open && !!instance;
  const shown = instance;

  // `keepAlive` keeps the node mounted through the exit animation. `mounted` is
  // DERIVED (visible || keepAlive), so opening never needs a setState — only the
  // visible→hidden edge does, to start the exit animation, and it is cleared
  // asynchronously by a timer (and on reopen the className keys off `visible`, so
  // a stale keepAlive can't show the wrong animation). Reacting to a prop edge to
  // run an unmount animation is the documented, unavoidable setState-in-effect
  // (it is exactly what motion libraries do internally).
  const [keepAlive, setKeepAlive] = React.useState(false);
  const mounted = visible || keepAlive;
  const prevVisible = React.useRef(visible);

  React.useEffect(() => {
    const was = prevVisible.current;
    prevVisible.current = visible;
    // Only act on the visible→hidden edge (closing). Opening is fully derived.
    if (visible || visible === was) return;
    if (prefersReducedMotion()) return; // unmount at once, no exit animation
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop-edge → start exit animation (see note above)
    setKeepAlive(true);
    const id = window.setTimeout(() => setKeepAlive(false), DURATION_MS);
    return () => window.clearTimeout(id);
  }, [visible]);

  // Focus the close button on open for keyboard users; lock body scroll.
  const closeRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    if (!visible) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  // Esc → 닫기 (키보드 사용자용 — X·뒤로가기와 같은 closeTop 경로).
  React.useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!mounted || !shown) return null;

  const def = registry[shown.type];
  // 상단 이름 — instanceTitle 위젯(노트)은 인스턴스 제목(config.title)을 표시하고,
  // 없거나 비었으면 displayName. config가 라이브로 내려오므로 제목 입력이 즉시 반영.
  const overlayTitle =
    (def?.instanceTitle ? def.instanceTitle(shown.config) : null) ||
    def?.displayName ||
    shown.type;
  // Exit animation plays while the node is alive but no longer "visible".
  const leaving = mounted && !visible;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-background"
      style={{
        animation: `${leaving ? "pb-overlay-out" : "pb-overlay-in"} ${DURATION_MS}ms ease-out`,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={def ? `${overlayTitle} 자세히 보기` : "위젯 자세히 보기"}
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        {def && typeof def.icon !== "string" && def.icon ? (
          <span className="flex size-5 items-center justify-center text-muted-foreground">
            {React.createElement(def.icon, { size: 18 })}
          </span>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          {overlayTitle}
        </h2>
        <IconButton ref={closeRef} label="닫기" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>

      <div className="@container/focus min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto h-full w-full max-w-screen-lg">
          {def ? (
            // ExpandedView 내부에서 오버레이를 닫을 수 있게(예: 노트 '제목만 접기'
            // = 접기 + 닫기 한 번에) 닫기 경로를 컨텍스트로 노출한다.
            <FocusCloseProvider onClose={onClose}>
              <def.ExpandedView
                key={shown.instanceId}
                config={shown.config}
                instanceId={shown.instanceId}
              />
            </FocusCloseProvider>
          ) : (
            <p className="text-sm text-muted-foreground">
              레지스트리에 등록되지 않은 타입입니다: {shown.type}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default FocusOverlay;
