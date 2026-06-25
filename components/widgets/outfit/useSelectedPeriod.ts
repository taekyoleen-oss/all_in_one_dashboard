"use client";

/**
 * useSelectedPeriod — 외출옷 추천의 '선택 시간대' 해석 훅.
 *
 *  저장된 선택(usePersistedPeriod, 인스턴스별)·config 기본값·자동('지금')을 합쳐
 *  실제 추천에 쓸 시간대(periodId)로 변환한다. 타일(CompactView)과 '전체'(ExpandedView)가
 *  같은 인스턴스 선택을 공유하므로 두 뷰가 항상 같은 시간대를 본다.
 *
 *  - selection: 사용자가 고른 값. 'auto'(지금) 또는 특정 시간대 id → PeriodPicker 하이라이트.
 *  - periodId : 추천 계산에 쓰는 실제 시간대. selection이 'auto'면 현재 시각(useNow)으로
 *    매 분 재계산되어, 시간이 흐르면 다음 구간으로 자동으로 넘어간다(요구: 최근 시간 반영).
 *
 *  특정 시간대 칩을 누르면 그 구간으로 '고정'되고, 다시 '지금' 칩을 누르면 자동 추적으로
 *  돌아온다. 고정 상태에서는 불필요한 리렌더를 피하려고 틱 주기를 시간당 1회로 늦춘다.
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

export function useSelectedPeriod(
  instanceId: string,
  configPeriod?: string,
): SelectedPeriod {
  const { period, setPeriod } = usePersistedPeriod(instanceId);

  // config '기본 시간대'가 실제로 바뀔 때만 동기화('전체'를 열어도 선택 유지).
  // 기본값 미설정이면 자동('지금')으로 둔다.
  const prevConfig = React.useRef(configPeriod);
  React.useEffect(() => {
    if (prevConfig.current !== configPeriod) {
      prevConfig.current = configPeriod;
      setPeriod(configPeriod ?? AUTO_PERIOD_ID);
    }
  }, [configPeriod, setPeriod]);

  const stored = period ?? configPeriod ?? AUTO_PERIOD_ID;

  // 분 단위 틱: 시간이 흐르면 현재 구간이 넘어가고, 지나간 칩은 롤링 윈도우에서 사라진다.
  const now = useNow(60_000);
  const slots = React.useMemo(
    // 분 단위로만 재계산(초 변동 무시)되도록 분 타임스탬프를 키로.
    () => buildForwardPeriods(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(now.getTime() / 60_000)],
  );

  // 저장된 고정 선택이 이미 지나가 윈도우에 없으면 자동('지금')으로 자가 복원.
  const inWindow =
    stored === AUTO_PERIOD_ID || slots.some((s) => s.key === stored);
  const selection = inWindow ? stored : AUTO_PERIOD_ID;
  const periodId =
    selection === AUTO_PERIOD_ID ? currentPeriodId(now) : selection;

  return { selection, periodId, setSelection: setPeriod, slots };
}

export default useSelectedPeriod;
