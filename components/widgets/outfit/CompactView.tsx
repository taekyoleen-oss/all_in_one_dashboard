"use client";

/**
 * 외출옷 추천 · CompactView — 캔버스 타일.
 *
 *  레이아웃(요구): 시간대 버튼(상단) → 본문 2단. 왼쪽에 날씨(위) + 추천 의상 설명
 *  (긴팔 셔츠·면바지 등) 목록, 오른쪽에 일러스트. 타일을 줄이면 일러스트도 함께 작아진다
 *  (OutfitIllustration fit). 폭이 좁으면 세로로 자동 스택.
 *
 *  선택 시간대는 인스턴스별로 저장(usePersistedPeriod)되어 타일↔'전체'가 공유한다.
 */

import * as React from "react";
import type { CompactViewProps } from "@/lib/widgets/contract";
import { RefreshBar } from "@/components/widgets/shared/RefreshBar";
import { useOutfit } from "./useOutfit";
import { buildOutfitSnapshot } from "./weatherMap";
import { recommendOutfit } from "./illustration/recommender";
import { OutfitIllustration } from "./illustration/OutfitIllustration";
import { PeriodPicker } from "./PeriodPicker";
import { useSelectedPeriod } from "./useSelectedPeriod";
import { activityIcon, activityLabel } from "./constants";
import type { OutfitConfig } from "./types";

export function OutfitCompactView({
  config,
  instanceId,
}: CompactViewProps<OutfitConfig>) {
  const { data, loading, error, lastUpdated, refresh } = useOutfit(config);
  const { selection, periodId, setSelection, slots } =
    useSelectedPeriod(instanceId);

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
  // 의상 설명: 필수 먼저, 그다음 선택. 우천/마스크 포함 전부.
  const items = [...result.items].sort(
    (a, b) => Number(b.required) - Number(a.required),
  );

  return (
    <div className="flex h-full flex-col gap-1.5">
      {/* 시간대 선택 — 상단 */}
      <PeriodPicker
        value={selection}
        onChange={setSelection}
        slots={slots}
        size="compact"
      />

      {/* 본문: 좌(날씨+의상) | 우(일러스트). 좁으면 세로 스택. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 @[300px]/widget:flex-row">
        {/* LEFT: 날씨(위) + 의상 설명(아래) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
          {/* 날씨 */}
          <div className="shrink-0">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs text-muted-foreground">
                {config.label}
              </p>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {activityIcon(config.activity)} {activityLabel(config.activity)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-semibold tabular-nums leading-none text-foreground @[260px]/widget:text-3xl">
                {Math.round(snap.feelsLike)}°
              </span>
              <span className="truncate text-xs text-foreground">
                체감 · {result.layerLabel}
              </span>
            </div>
            <RefreshBar
              lastUpdated={lastUpdated}
              onRefresh={refresh}
              size="compact"
            />
            {result.cancelActivity ? (
              <p className="mt-0.5 truncate text-[11px] font-medium text-destructive">
                ⚠ 야외활동 주의 — 자세히에서 확인
              </p>
            ) : null}
          </div>

          {/* 의상 설명 목록 */}
          <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-scroll">
            {items.map((it) => (
              <li
                key={it.id}
                className={[
                  "flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs",
                  it.required
                    ? "border-primary/40 bg-primary/5 text-foreground"
                    : "border-border bg-background/40 text-foreground",
                ].join(" ")}
                title={it.condition}
              >
                <span aria-hidden className="shrink-0">
                  {it.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                <span
                  className={[
                    "shrink-0 text-[10px]",
                    it.required ? "text-primary" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {it.activityTag ?? (it.required ? "필수" : "선택")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: 일러스트 — 박스에 맞춰 축소(타일 줄이면 함께 작아짐) */}
        <div className="flex min-h-0 min-w-0 items-center justify-center @[300px]/widget:basis-[44%]">
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
            fit
          />
        </div>
      </div>
    </div>
  );
}

export default OutfitCompactView;
