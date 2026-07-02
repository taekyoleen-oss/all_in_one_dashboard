"use client";

/**
 * useSelectedPeriod — 외출옷 추천의 '선택 시간대' 해석 훅.
 *
 *  기본값은 항상 '지금'(auto)이다(요구: 기본값이 지금). 특정 시간대 칩을 누르면 그
 *  구간으로 '고정'되지만, 그 선택은 일정 시간(REVERT_MS)이 지나면 자동으로 '지금'으로
 *  되돌아간다(요구: 다른 시간대를 골라도 시간이 지나면 지금으로 복귀). 지나간 구간도
 *  롤링 윈도우에서 사라지면 마찬가지로 '지금'으로 자가 복원된다.
 *
 *  타일(CompactView)과 '전체'(ExpandedView)가 같은 인스턴스 선택을 공유하므로 두 뷰가
 *  항상 같은 시간대를 본다(usePersistedPeriod).
 *
 *  - selection: 사용자가 고른 값. 'auto'(지금) 또는 특정 시간대 key → PeriodPicker 하이라이트.
 *  - periodId : 추천 계산에 쓰는 실제 시간대. selection이 'auto'면 현재 시각(useNow)으로
 *    매 분 재계산되어, 시간이 흐르면 다음 구간으로 자동으로 넘어간다.
 */

import * as React from "react";
import { useNow } from "@/lib/utils/useNow";
import { usePersistedPeriod } from "./usePersistedPeriod";
import {
  AUTO_PERIOD_ID,
  buildForwardPeriods,
  currentPeriodId,
  type PeriodSlot,
} from "./constants";

/** 비-'지금' 선택을 유지하는 시간(ms). 이만큼 지나면 자동으로 '지금'으로 복귀한다. */
const REVERT_MS = 10 * 60_000; // 10분

const AT_PREFIX = "pb:outfitPeriodAt:";
const atKeyOf = (id: string) => AT_PREFIX + id;

/** 선택 시각(epoch ms) 읽기 — 없으면 null. */
function readSelectedAt(id: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(atKeyOf(id));
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** 선택 시각 저장/삭제. */
function writeSelectedAt(id: string, at: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (at == null) window.localStorage.removeItem(atKeyOf(id));
    else window.localStorage.setItem(atKeyOf(id), String(at));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export interface SelectedPeriod {
  /** 사용자 선택값('auto' 또는 시간대 키) — PeriodPicker 하이라이트용. */
  selection: string;
  /** 추천 계산에 쓰는 실제 시간대 키(자동이면 현재 시각 반영). */
  periodId: string;
  /** 칩 클릭 시 선택 갱신('auto' 포함). */
  setSelection: (id: string) => void;
  /** '현재→미래' 롤링 시간대 슬롯(오늘 남은 구간 + 내일). PeriodPicker가 렌더. */
  slots: PeriodSlot[];
}

export function useSelectedPeriod(instanceId: string): SelectedPeriod {
  const { period, setPeriod } = usePersistedPeriod(instanceId);

  // 칩 클릭: '지금'이면 고정 해제(선택 시각도 삭제), 특정 구간이면 그 구간으로 고정하고
  // 선택 시각을 찍는다(REVERT_MS 후 자동 복귀 기준).
  const setSelection = React.useCallback(
    (id: string) => {
      if (id === AUTO_PERIOD_ID) {
        writeSelectedAt(instanceId, null);
        setPeriod(null);
      } else {
        writeSelectedAt(instanceId, Date.now());
        setPeriod(id);
      }
    },
    [instanceId, setPeriod],
  );

  // 저장된 선택(없으면 '지금'이 기본).
  const stored = period ?? AUTO_PERIOD_ID;

  // 분 단위 틱: 시간이 흐르면 현재 구간이 넘어가고, 지나간 칩은 롤링 윈도우에서 사라진다.
  const now = useNow(60_000);
  // 분 단위로만 재계산(초 변동 무시)되도록 분 타임스탬프를 키로 파생.
  const minuteKey = Math.floor(now.getTime() / 60_000);
  const slots = React.useMemo(
    () => buildForwardPeriods(new Date(minuteKey * 60_000)),
    [minuteKey],
  );

  // 복귀 판정: (1) 선택 후 REVERT_MS 경과, 또는 (2) 롤링 윈도우에서 사라진 지난 구간이면
  // '지금'으로 되돌린다.
  const selectedAt = stored === AUTO_PERIOD_ID ? null : readSelectedAt(instanceId);
  const expired = selectedAt != null && now.getTime() - selectedAt > REVERT_MS;
  const inWindow =
    stored === AUTO_PERIOD_ID || slots.some((s) => s.key === stored);
  const selection = inWindow && !expired ? stored : AUTO_PERIOD_ID;
  const periodId =
    selection === AUTO_PERIOD_ID ? currentPeriodId(now) : selection;

  // 만료/윈도우 이탈로 '지금'으로 판정됐는데 저장값이 아직 남아 있으면 정리한다.
  React.useEffect(() => {
    if (selection === AUTO_PERIOD_ID && period != null) {
      writeSelectedAt(instanceId, null);
      setPeriod(null);
    }
  }, [selection, period, instanceId, setPeriod]);

  return { selection, periodId, setSelection, slots };
}

export default useSelectedPeriod;
