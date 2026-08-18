"use client";

/**
 * Shared inline-edit wiring for the memo fields (제목 + 본문 — 타일/전체보기 넷 다
 * 편집기). Uncontrolled input/textarea (caret-safe) + debounced persist, plus an
 * external-sync effect: when the field changes elsewhere (다른 뷰에서 편집, 헤더
 * 제목 변경, 다른 기기 동기화) and THIS element is not focused, refresh its DOM
 * value — otherwise a later blur here would persist stale text over the newer edit.
 */

import * as React from "react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import type { MemoConfig } from "./types";

/** 편집 가능한 텍스트 필드(문자열) 키. */
type MemoTextField = "text" | "title";

export function useMemoText<E extends HTMLTextAreaElement | HTMLInputElement>(
  instanceId: string,
  config: MemoConfig,
  field: MemoTextField = "text",
) {
  const save = useSaveWidgetConfig();
  const ref = React.useRef<E | null>(null);

  // Latest config in a ref so the debounced save always merges the current
  // color/size, not a stale closure. (렌더 중 ref 쓰기 대신 커밋 후 동기화)
  const configRef = React.useRef(config);
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);
  const timer = React.useRef<number | null>(null);

  const persist = React.useCallback(
    (value: string, debounce: boolean) => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const run = () => save(instanceId, { ...configRef.current, [field]: value });
      if (debounce) timer.current = window.setTimeout(run, 500);
      else run();
    },
    [instanceId, save, field],
  );

  React.useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  // 저장된 값(제목은 미설정 시 undefined → 빈 문자열로 다룬다).
  const value = config[field] ?? "";

  // External sync — focused면 사용자가 여기서 입력 중이므로 그 값이 우선.
  React.useEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.value !== value) el.value = value;
  }, [value]);

  return {
    ref,
    defaultValue: value,
    onChange: (e: React.ChangeEvent<E>) => persist(e.target.value, true),
    onBlur: (e: React.FocusEvent<E>) => persist(e.target.value, false),
  };
}
