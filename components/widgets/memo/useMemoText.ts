"use client";

/**
 * Shared inline-edit wiring for the memo textareas (타일 + 전체보기 — 둘 다
 * 편집기). Uncontrolled textarea (caret-safe) + debounced persist, plus an
 * external-sync effect: when config.text changes elsewhere (다른 뷰에서 편집,
 * 다른 기기 동기화) and THIS textarea is not focused, refresh its DOM value —
 * otherwise a later blur here would persist stale text over the newer edit.
 */

import * as React from "react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import type { MemoConfig } from "./types";

export function useMemoText(instanceId: string, config: MemoConfig) {
  const save = useSaveWidgetConfig();
  const ref = React.useRef<HTMLTextAreaElement | null>(null);

  // Latest config in a ref so the debounced save always merges the current
  // color/size, not a stale closure. (렌더 중 ref 쓰기 대신 커밋 후 동기화)
  const configRef = React.useRef(config);
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);
  const timer = React.useRef<number | null>(null);

  const persist = React.useCallback(
    (text: string, debounce: boolean) => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const run = () => save(instanceId, { ...configRef.current, text });
      if (debounce) timer.current = window.setTimeout(run, 500);
      else run();
    },
    [instanceId, save],
  );

  React.useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  // External sync — focused면 사용자가 여기서 입력 중이므로 그 값이 우선.
  React.useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.value !== config.text) el.value = config.text;
  }, [config.text]);

  return {
    ref,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      persist(e.target.value, true),
    onBlur: (e: React.FocusEvent<HTMLTextAreaElement>) =>
      persist(e.target.value, false),
  };
}
