"use client";

/**
 * dday · CompactView — countdown(s) to target date(s) (설계서 §2.2).
 *
 *  Shows each entry's "D-12" / "D-Day" badge (recomputed at midnight via a slow
 *  tick). Tone is conveyed by BOTH color and the D-/D+ symbol. 타일 하단 QuickAdd로
 *  제목+날짜를 바로 추가한다.
 */

import * as React from "react";
import { format } from "date-fns";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { useNow } from "@/lib/utils/useNow";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import {
  QuickAdd,
  newItemId,
  quickInputClass,
  quickBtnClass,
} from "@/components/widgets/shared/QuickAdd";
import { computeDDay } from "./compute";
import type { DDayConfig } from "./types";

const TONE_CLASS: Record<string, string> = {
  future: "text-primary",
  today: "text-positive",
  past: "text-muted-foreground",
};

export function DDayCompactView({
  config,
  instanceId,
  density,
}: CompactViewProps<DDayConfig>) {
  // Day-resolution: tick once a minute so it flips at midnight without churn.
  const now = useNow(60_000);
  const big = density !== "compact";

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {config.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">D-Day가 없습니다.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-scroll">
          {/* my-auto: 항목이 적으면 세로 가운데, 넘치면 위에서부터 스크롤(잘림 없음). */}
          <ul className="my-auto flex flex-col gap-2">
          {config.entries.map((e) => {
            const r = computeDDay(e, now);
            return (
              <li key={e.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {e.label || "(제목 없음)"}
                    {e.repeatYearly ? (
                      <span className="ml-1 align-middle text-[10px] text-muted-foreground">
                        매년
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {r.targetText}
                  </span>
                </div>
                <span
                  className={[
                    "shrink-0 font-mono font-semibold tabular-nums",
                    big ? "text-xl @[260px]/widget:text-2xl" : "text-lg",
                    TONE_CLASS[r.tone],
                  ].join(" ")}
                >
                  {r.label}
                </span>
              </li>
            );
          })}
          </ul>
        </div>
      )}

      <DDayQuickAdd config={config} instanceId={instanceId} />
    </div>
  );
}

/** 타일 하단 빠른 추가: 제목 + 날짜(기본 오늘). */
function DDayQuickAdd({
  config,
  instanceId,
}: {
  config: DDayConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const [label, setLabel] = React.useState("");
  const [date, setDate] = React.useState(() => format(new Date(), "yyyy-MM-dd"));
  const add = () => {
    const l = label.trim();
    if (!l || !date) return;
    save(instanceId, {
      ...config,
      entries: [
        ...config.entries,
        { id: newItemId("dday"), label: l, date, repeatYearly: false },
      ],
    });
    setLabel("");
  };
  return (
    <QuickAdd label="D-Day 추가">
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
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="제목 (예: 프로젝트 마감)"
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
            <button type="submit" disabled={!label.trim()} className={quickBtnClass}>
              추가
            </button>
          </div>
        </form>
      )}
    </QuickAdd>
  );
}

export default DDayCompactView;
