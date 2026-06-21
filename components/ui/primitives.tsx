"use client";

/**
 * ============================================================================
 *  Token-styled UI primitives (shadcn not initialized yet — see tweakcn-theme)
 * ============================================================================
 *
 *  Minimal, dependency-free building blocks that match WidgetFrame's token style
 *  (bg-card / border-border / text-foreground / accent hover). When shadcn is
 *  later initialized these can be swapped for its Button / DropdownMenu without
 *  touching call sites (same surface).
 *
 *  Accessibility: IconButton is a real <button> (keyboard + 36px touch target).
 *  DropdownMenu closes on outside-click / Escape and moves focus into the menu;
 *  items are <button role="menuitem"> reachable by Tab.
 * ============================================================================
 */

import * as React from "react";
import { createPortal } from "react-dom";

/* ------------------------------- IconButton ------------------------------- */

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label (required — icon-only buttons need a name). */
  label: string;
  /** Visual emphasis. */
  variant?: "ghost" | "solid";
  /** Pressed/active state (toggle buttons) → reflected via aria-pressed. */
  active?: boolean;
}

/** 36px ghost (or solid) icon button — the toolbar/menu trigger workhorse. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, variant = "ghost", active, className, children, ...rest },
    ref,
  ) {
    const base =
      "inline-flex size-9 shrink-0 items-center justify-center rounded-md " +
      "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring " +
      "disabled:pointer-events-none disabled:opacity-50";
    const skin =
      variant === "solid"
        ? "bg-primary text-primary-foreground hover:opacity-90"
        : active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground";
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        aria-pressed={active}
        className={[base, skin, className ?? ""].join(" ")}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

/* ------------------------------ DropdownMenu ------------------------------ */

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownMenu() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx)
    throw new Error("DropdownMenu.* must be used within <DropdownMenu>");
  return ctx;
}

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  // Close on outside click + Escape; restore focus to the trigger on Escape.
  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider
      value={{ open, setOpen, triggerRef, menuRef }}
    >
      <div className="relative inline-flex">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

export interface DropdownMenuTriggerProps {
  children: React.ReactElement<{
    ref?: React.Ref<HTMLButtonElement>;
    onClick?: (e: React.MouseEvent) => void;
    "aria-haspopup"?: boolean | "menu";
    "aria-expanded"?: boolean;
  }>;
}

/** Renders its child as the trigger (must be a button-like element). */
export function DropdownMenuTrigger({ children }: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdownMenu();
  return React.cloneElement(children, {
    ref: triggerRef,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    onClick: (e: React.MouseEvent) => {
      children.props.onClick?.(e);
      setOpen(!open);
    },
  });
}

export interface DropdownMenuContentProps {
  children: React.ReactNode;
  /** Horizontal alignment relative to the trigger. */
  align?: "start" | "end";
  className?: string;
}

export function DropdownMenuContent({
  children,
  align = "end",
  className,
}: DropdownMenuContentProps) {
  const { open, menuRef, triggerRef } = useDropdownMenu();
  // Fixed viewport coords (null until measured). The menu is PORTALED to <body>
  // so it escapes the widget frame's overflow-hidden — otherwise a tile low on
  // the screen would clip its own menu to the tile's height (요구: 속성 전체 표시).
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null,
  );

  // Position below the trigger, flipping ABOVE when there isn't room, and clamp
  // into the viewport. Re-runs on open + scroll/resize so it tracks the trigger.
  React.useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      const m = menuRef.current?.getBoundingClientRect();
      if (!t || !m) return;
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let top = t.bottom + 4;
      if (top + m.height > vh - margin) {
        const above = t.top - 4 - m.height;
        top = above >= margin ? above : Math.max(margin, vh - margin - m.height);
      }
      let left = align === "end" ? t.right - m.width : t.left;
      left = Math.min(Math.max(margin, left), Math.max(margin, vw - margin - m.width));
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, align, triggerRef, menuRef]);

  // Move focus into the menu once it's positioned (focus the first item).
  React.useEffect(() => {
    if (!open || !pos) return;
    const first = menuRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([disabled])',
    );
    first?.focus();
  }, [open, pos, menuRef]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        // Hidden until measured so it never flashes at the wrong spot.
        visibility: pos ? "visible" : "hidden",
        maxHeight: "80vh",
      }}
      className={[
        "z-[80] min-w-44 overflow-y-auto rounded-md border border-border",
        "bg-popover p-1 text-popover-foreground shadow-md",
        "[scrollbar-width:thin]",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>,
    document.body,
  );
}

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render as a destructive (red) action. */
  destructive?: boolean;
  /** Optional leading icon node. */
  icon?: React.ReactNode;
}

export function DropdownMenuItem({
  destructive,
  icon,
  className,
  children,
  onClick,
  ...rest
}: DropdownMenuItemProps) {
  const { setOpen } = useDropdownMenu();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) setOpen(false);
      }}
      className={[
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
        "transition-colors focus-visible:bg-accent hover:bg-accent",
        "disabled:pointer-events-none disabled:opacity-40",
        destructive
          ? "text-destructive focus-visible:bg-destructive/10 hover:bg-destructive/10"
          : "text-popover-foreground",
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {icon ? (
        <span className="flex size-4 items-center justify-center">{icon}</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownMenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />;
}
