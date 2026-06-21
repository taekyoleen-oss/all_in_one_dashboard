"use client";

/**
 * LockedMemo — the shared body for the password-memo widget. When a password is
 * set, shows an unlock prompt and AUTO-RELOCKS after `lockAfterMin` of inactivity;
 * once unlocked (or when no password) it's an inline-editable textarea that
 * persists via the widget-persistence context (debounced).
 */

import * as React from "react";
import { Lock } from "lucide-react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { effectiveText, hashPassword, type EssentialInfoConfig } from "./types";

export function LockedMemo({
  config,
  instanceId,
  size = "compact",
}: {
  config: EssentialInfoConfig;
  instanceId: string;
  size?: "compact" | "expanded";
}) {
  const save = useSaveWidgetConfig();
  const hasLock = !!config.pwHash;
  const [unlocked, setUnlocked] = React.useState(!hasLock);
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(false);

  const configRef = React.useRef(config);
  configRef.current = config;
  const relockTimer = React.useRef<number | null>(null);
  const saveTimer = React.useRef<number | null>(null);
  const relockMs = Math.max(1, config.lockAfterMin || 5) * 60_000;

  // Re-lock whenever the password presence changes (e.g. set in the editor).
  React.useEffect(() => {
    setUnlocked(!hasLock);
  }, [hasLock, instanceId]);

  const armRelock = React.useCallback(() => {
    if (!hasLock) return;
    if (relockTimer.current != null) window.clearTimeout(relockTimer.current);
    relockTimer.current = window.setTimeout(
      () => setUnlocked(false),
      relockMs,
    );
  }, [hasLock, relockMs]);

  React.useEffect(
    () => () => {
      if (relockTimer.current != null) window.clearTimeout(relockTimer.current);
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    },
    [],
  );

  const tryUnlock = async () => {
    const h = await hashPassword(pw);
    if (h && h === config.pwHash) {
      setUnlocked(true);
      setPw("");
      setErr(false);
      armRelock();
    } else {
      setErr(true);
    }
  };

  const onEdit = (text: string) => {
    if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(
      () => save(instanceId, { ...configRef.current, text }),
      500,
    );
    armRelock();
  };

  if (hasLock && !unlocked) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void tryUnlock();
        }}
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

  return (
    <textarea
      defaultValue={effectiveText(config)}
      onChange={(e) => onEdit(e.target.value)}
      onBlur={(e) => {
        if (saveTimer.current != null) window.clearTimeout(saveTimer.current);
        save(instanceId, { ...configRef.current, text: e.target.value });
      }}
      placeholder="자유롭게 메모하세요…"
      spellCheck={false}
      data-pb-no-drag=""
      className={[
        "h-full w-full resize-none bg-transparent leading-relaxed outline-none",
        "text-foreground placeholder:italic placeholder:text-muted-foreground",
        "[scrollbar-width:thin]",
        size === "expanded" ? "text-base" : "text-sm",
      ].join(" ")}
    />
  );
}

export default LockedMemo;
