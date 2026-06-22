"use client";

/**
 * upcoming · ExpandedView — '전체보기'(자세히)에서 다가오는 일정을 크게 나열.
 *
 *  CompactView와 동일한 계산(오늘 이후·가까운 순)에 더 큰 카드. 일정 관리(추가/수정)는
 *  위젯 메뉴의 '편집'(ConfigEditor)에서 한다 — 동결된 컨트랙트(여기엔 onChange 없음).
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { upcomingEvents } from "./compute";
import { EventRow } from "./EventRow";
import type { UpcomingConfig } from "./types";

export function UpcomingExpandedView({ config }: ExpandedViewProps<UpcomingConfig>) {
  const now = useNow(60_000);
  const rows = React.useMemo(
    () => upcomingEvents(config.events, now),
    [config.events, now],
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        다가오는 일정 · 총 {rows.length}개
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          다가오는 일정이 없습니다. 위젯 메뉴의 “편집”에서 추가하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <EventRow key={r.event.id} readout={r} size="expanded" />
          ))}
        </ul>
      )}
    </div>
  );
}

export default UpcomingExpandedView;
