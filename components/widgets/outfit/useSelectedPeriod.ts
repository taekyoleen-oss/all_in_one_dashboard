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
import { AUTO_PERIOD_ID, currentPeriodId } from "./constants";

export interface SelectedPeriod {
  /** 사용자 선택값('auto' 또는 시간대 id) — PeriodPicker 하이라이트용. */
  selection: string;
  /** 추천 계산에 쓰는 실제 시간대 id(자동이면 현재 시각 반영). */
  periodId: string;
  /** 칩 클릭 시 선택 갱신('auto' 포함). */
  setSelection: (id: string) => void;
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

  const selection = period ?? configPeriod ?? AUTO_PERIOD_ID;
  const isAuto = selection === AUTO_PERIOD_ID;

  // 자동일 때만 분 단위로 틱(시간대 경계를 넘으면 추천 갱신). 고정이면 시간당 1회로 최소화.
  const now = useNow(isAuto ? 60_000 : 3_600_000);
  const periodId = isAuto ? currentPeriodId(now) : selection;

  return { selection, periodId, setSelection: setPeriod };
}

export default useSelectedPeriod;
