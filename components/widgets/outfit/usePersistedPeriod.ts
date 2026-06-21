"use client";

/**
 * 외출옷 추천 — 인스턴스별 선택 시간대 저장 (localStorage, 반응형).
 *
 *  타일(CompactView)과 전체(ExpandedView)가 같은 인스턴스의 선택 시간대를 공유하도록
 *  per-instance localStorage 스토어로 보관한다(usePersistedTitle과 동일 패턴). '전체'를
 *  눌러도 타일에서 고른 시간대가 유지된다(요구). 값이 없으면 null → 호출부가 config
 *  기본값/현재 시각으로 폴백.
 */

import * as React from "react";

const PREFIX = "pb:outfitPeriod:";
const keyOf = (id: string) => PREFIX + id;
const listeners = new Map<string, Set<() => void>>();

function read(id: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyOf(id));
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

function write(id: string, value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!value) window.localStorage.removeItem(keyOf(id));
    else window.localStorage.setItem(keyOf(id), value);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  listeners.get(id)?.forEach((l) => l());
}

function subscribe(id: string, cb: () => void): () => void {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === keyOf(id)) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set?.delete(cb);
    if (set && set.size === 0) listeners.delete(id);
    window.removeEventListener("storage", onStorage);
  };
}

export interface PeriodControls {
  /** Stored selected period id, or null when unset (caller falls back). */
  period: string | null;
  setPeriod: (value: string | null) => void;
}

export function usePersistedPeriod(instanceId: string): PeriodControls {
  const sub = React.useCallback(
    (cb: () => void) => subscribe(instanceId, cb),
    [instanceId],
  );
  const period = React.useSyncExternalStore(
    sub,
    React.useCallback(() => read(instanceId), [instanceId]),
    () => null,
  );
  const setPeriod = React.useCallback(
    (value: string | null) => write(instanceId, value),
    [instanceId],
  );
  return { period, setPeriod };
}
