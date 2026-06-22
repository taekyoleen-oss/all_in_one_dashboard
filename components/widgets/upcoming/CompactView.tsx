"use client";

/**
 * upcoming · CompactView — 다가오는 일정 목록(타일).
 *
 *  config.events에서 오늘 이후 일정을 가까운 순으로 계산(useNow로 자정마다 갱신)해
 *  EventRow 카드로 나열한다. 지난 일정은 자동으로 숨고, 넘치면 스크롤된다. 타일
 *  하단 QuickAdd로 제목+날짜를 바로 추가한다(제목 키워드로 시간 자동 설정).
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  newItemId,
  quickInputClass,
  quickBtnClass,
} from "@/components/widgets/shared/QuickAdd";
import { upcomingEvents, suggestTimeFromTitle } from "./compute";
import { EventRow } from "./EventRow";
import type { UpcomingConfig } from "./types";

export function UpcomingCompactView({
  config,
  instanceId,
}: CompactViewProps<UpcomingConfig>) {
  // 일(day) 해상도면 충분 — 1분 틱으로 자정 경계만 넘기면 D-day가 갱신된다.
  const now = useNow(60_000);
  const rows = React.useMemo(
    () => upcomingEvents(config.events, now),
    [config.events, now],
  );

  return (
    <div className="flex h-full flex-col gap-1.5">
      <p className="shrink-0 text-xs text-muted-foreground">
        {config.events.length === 0
          ? "일정이 없습니다."
          : rows.length === 0
            ? "다가오는 일정이 없습니다."
            : `다가오는 일정 ${rows.length}개`}
      </p>
      {rows.length > 0 ? (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-scroll">
          {rows.map((r) => (
            <EventRow key={r.event.id} readout={r} size="compact" />
          ))}
        </ul>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      <UpcomingQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

/** 타일 하단 빠른 추가: 제목 + 날짜. 제목 키워드(점심/아침/저녁)로 시간을 자동 설정. */
function UpcomingQuickAdd({
  config,
  instanceId,
}: {
  config: UpcomingConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState("");
  const add = () => {
    const t = title.trim();
    if (!t || !date) return;
    const time = suggestTimeFromTitle(t) ?? "";
    save(instanceId, {
      ...config,
      events: [
        ...config.events,
        { id: newItemId("evt"), title: t, date, time },
      ],
    });
    setTitle("");
  };
  return (
    <QuickAdd label="일정 추가">
      {() => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex flex-col gap-1.5"
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 (예: 점심 약속)"
            className={`${quickInputClass} w-full`}
          />
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="날짜"
              className={`${quickInputClass} flex-1`}
            />
            <button
              type="submit"
              disabled={!title.trim() || !date}
              className={quickBtnClass}
            >
              추가
            </button>
          </div>
        </form>
      )}
    </QuickAdd>
  );
}

export default UpcomingCompactView;
