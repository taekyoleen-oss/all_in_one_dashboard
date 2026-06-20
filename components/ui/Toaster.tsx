"use client";

/**
 * ============================================================================
 *  Toaster — minimal, dependency-free toast surface (설계서 §5.4 실패 토스트)
 * ============================================================================
 *
 *  Persistence failures (debounced upsert/delete to Supabase rejecting) surface
 *  here as a toast with an optional 다시 시도 (retry) action — §5.4: "실패 시
 *  토스트·재시도·로컬 드래프트". Token-styled to match the rest of the shell; no
 *  external toast library (sonner/radix) is pulled in.
 *
 *  Usage:
 *    <ToastProvider> wraps the app (in CanvasShell). Anywhere under it,
 *    `const { toast } = useToast()` pushes a toast:
 *      toast({ title, description?, variant?, action?, durationMs? })
 *
 *  Accessibility: the live region is role="status" aria-live="polite"; error
 *  toasts use aria-live="assertive". Each toast is dismissable.
 * ============================================================================
 */

import * as React from "react";
import { X, AlertTriangle, RotateCcw, CheckCircle2 } from "lucide-react";

export type ToastVariant = "default" | "error" | "success";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
  /** Auto-dismiss after this many ms. Errors default to longer / sticky-ish. */
  durationMs?: number;
}

interface ToastRecord extends Required<Pick<ToastOptions, "title">> {
  id: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
  durationMs: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  default: 4000,
  success: 3000,
  error: 8000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const timers = React.useRef<Map<string, number>>(new Map());

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle != null) {
      window.clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback(
    (opts: ToastOptions) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const variant = opts.variant ?? "default";
      const durationMs = opts.durationMs ?? DEFAULT_DURATION[variant];
      const record: ToastRecord = {
        id,
        title: opts.title,
        description: opts.description,
        variant,
        action: opts.action,
        durationMs,
      };
      setToasts((prev) => [...prev, record]);
      if (durationMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss],
  );

  // Clear all timers on unmount.
  React.useEffect(() => {
    const map = timers.current;
    return () => {
      for (const handle of map.values()) window.clearTimeout(handle);
      map.clear();
    };
  }, []);

  const value = React.useMemo<ToastContextValue>(
    () => ({ toast, dismiss }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
}) {
  const icon =
    toast.variant === "error" ? (
      <AlertTriangle size={18} className="text-destructive" />
    ) : toast.variant === "success" ? (
      <CheckCircle2 size={18} className="text-primary" />
    ) : null;

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      className={[
        "pointer-events-auto flex items-start gap-3 rounded-[var(--radius)] border bg-card px-4 py-3 shadow-lg",
        "motion-safe:animate-[pb-overlay-in_180ms_ease-out]",
        toast.variant === "error" ? "border-destructive/40" : "border-border",
      ].join(" ")}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-card-foreground">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {toast.description}
          </p>
        ) : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw size={13} />
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="닫기"
        onClick={() => onDismiss(toast.id)}
        className="-mr-1 -mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default ToastProvider;
