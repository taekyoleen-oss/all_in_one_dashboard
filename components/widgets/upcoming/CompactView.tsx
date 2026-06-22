"use client";

/**
 * upcoming · CompactView — 다가오는 일정 목록(타일).
 *
 *  config.events에서 오늘 이후 일정을 가까운 순으로 계산(useNow로 자정마다 갱신)해
 *  EventRow 카드로 나열한다. 지난 일정은 자동으로 숨고, 넘치면 스크롤된다.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { upcomingEvents } from "./compute";
import { EventRow } from "./EventRow";
import type { UpcomingConfig } from "./types";

export function UpcomingCompactView({ config }: CompactViewProps<UpcomingConfig>) {
  // 일(day) 해상도면 충분 — 1분 틱으로 자정 경계만 넘기면 D-day가 갱신된다.
  const now = useNow(60_000);
  const rows = React.useMemo(
    () => upcomingEvents(config.events, now),
    [config.events, now],
  );

  if (config.events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        일정이 없습니다. 편집에서 추가하세요.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        다가오는 일정이 없습니다. 편집에서 추가하세요.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-1.5">
      <p className="shrink-0 text-xs text-muted-foreground">
        다가오는 일정 {rows.length}개
      </p>
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-scroll">
        {rows.map((r) => (
          <EventRow key={r.event.id} readout={r} size="compact" />
        ))}
      </ul>
    </div>
  );
}

export default UpcomingCompactView;
