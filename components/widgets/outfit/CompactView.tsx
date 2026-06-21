"use client";

/**
 * 외출옷 추천 · CompactView — 캔버스 타일.
 *
 *  위치/시간대 기준 체감온도 → 추천 코디 일러스트(원본과 동일한 캐릭터 합성)를 보여준다.
 *  타일에서 시간대를 바로 바꿀 수 있고(시간대 선택), 핵심 추천 아이템 몇 개를 칩으로 띄운다.
 *  성별·활동·체감 보정은 설정(ConfigEditor)에서 바꾼다.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { RefreshBar } from "@/components/widgets/shared/RefreshBar";
import { useOutfit } from "./useOutfit";
import { buildOutfitSnapshot } from "./weatherMap";
import { recommendOutfit } from "./illustration/recommender";
import { OutfitIllustration } from "./illustration/OutfitIllustration";
import { PeriodPicker } from "./PeriodPicker";
import {
  activityIcon,
  activityLabel,
  getOutfitPeriodIndex,
  OUTFIT_PERIODS,
} from "./constants";
import type { OutfitConfig } from "./types";

function currentPeriodId(): string {
  return OUTFIT_PERIODS[getOutfitPeriodIndex(new Date().getHours())].id;
}

export function OutfitCompactView({ config }: CompactViewProps<OutfitConfig>) {
  const { data, loading, error, lastUpdated, refresh } = useOutfit(config);

  const [periodId, setPeriodId] = React.useState<string>(
    config.periodId ?? currentPeriodId(),
  );
  // 설정에서 기본 시간대를 바꾸면 타일에도 반영.
  React.useEffect(() => {
    setPeriodId(config.periodId ?? currentPeriodId());
  }, [config.periodId]);

  const computed = React.useMemo(() => {
    if (!data) return null;
    const snap = buildOutfitSnapshot(data, {
      gender: config.gender,
      activity: config.activity,
      sensitivity: config.sensitivity,
      periodId,
    });
    return { snap, result: recommendOutfit(snap.input) };
  }, [data, config.gender, config.activity, config.sensitivity, periodId]);

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">날씨 불러오는 중…</p>;
  }
  if ((error && !data) || !data || !computed) {
    return (
      <p className="text-sm text-muted-foreground">
        날씨를 불러오지 못했습니다.
      </p>
    );
  }

  const { snap, result } = computed;
  const requiredItems = result.items
    .filter((i) => i.required && i.category !== "mask")
    .slice(0, 4);

  return (
    <div className="flex h-full flex-col gap-1">
      {/* 시간대 선택 — 상단 */}
      <PeriodPicker value={periodId} onChange={setPeriodId} size="compact" />

      {/* 위치 · 활동 */}
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="truncate text-xs text-muted-foreground">
          {config.label}
        </p>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {activityIcon(config.activity)} {activityLabel(config.activity)}
        </span>
      </div>
      <RefreshBar lastUpdated={lastUpdated} onRefresh={refresh} size="compact" />

      {/* 체감온도 · 구간 라벨 */}
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums leading-none text-foreground @[200px]/widget:text-3xl">
          {Math.round(snap.feelsLike)}°
        </span>
        <span className="truncate text-xs text-foreground">
          체감 · {result.layerLabel}
        </span>
      </div>

      {/* 일러스트 */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <OutfitIllustration
          illustKey={result.heroIllust}
          gender={config.gender}
          tempZone={result.tempZone}
          weatherSky={{ skyCode: snap.skyCode, ptyCode: snap.ptyCode }}
          precipitation={result.precipitation}
          windAlert={result.windAlert}
          showSunshine={snap.showSunshine}
          isNight={snap.isNight}
          calendarMonth={snap.calendarMonth}
          showLabel={false}
          maxWidth={220}
          className="min-h-0"
        />
      </div>

      {/* 핵심 추천 아이템 칩 */}
      {requiredItems.length > 0 ? (
        <ul className="flex shrink-0 flex-wrap items-center justify-center gap-1">
          {requiredItems.map((it) => (
            <li
              key={it.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-1.5 py-0.5 text-[11px] text-foreground"
            >
              <span aria-hidden>{it.icon}</span>
              {it.name}
            </li>
          ))}
        </ul>
      ) : null}

      {/* 위험/취소 경고 */}
      {result.cancelActivity ? (
        <p className="shrink-0 truncate text-center text-[11px] font-medium text-destructive">
          ⚠ 야외활동 주의 — 자세히에서 확인
        </p>
      ) : null}
    </div>
  );
}

export default OutfitCompactView;
