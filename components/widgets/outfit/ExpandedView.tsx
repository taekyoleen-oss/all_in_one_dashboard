"use client";

/**
 * 외출옷 추천 · ExpandedView — 전체 화면.
 *
 *  레이아웃(요구): 시간대(상단) → 2단. 왼쪽에 날씨(위) + 카테고리별 추천 의상 설명 +
 *  위험/팁, 오른쪽에 일러스트(공간 활용). 선택 시간대는 타일과 공유(usePersistedPeriod)
 *  되어 '전체'를 눌러도 유지된다.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useOutfit } from "./useOutfit";
import { buildOutfitSnapshot } from "./weatherMap";
import { recommendOutfit } from "./illustration/recommender";
import { OutfitIllustration } from "./illustration/OutfitIllustration";
import { PeriodPicker } from "./PeriodPicker";
import { useSelectedPeriod } from "./useSelectedPeriod";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type OutfitCategoryKey,
} from "./illustration/categories";
import type { OutfitItem } from "./illustration/types";
import { activityIcon, activityLabel } from "./constants";
import type { OutfitConfig } from "./types";

export function OutfitExpandedView({
  config,
  instanceId,
}: ExpandedViewProps<OutfitConfig>) {
  const { data, loading, error, refresh } = useOutfit(config);
  const { selection, periodId, setSelection } = useSelectedPeriod(
    instanceId,
    config.periodId,
  );

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

  const byCategory = new Map<OutfitCategoryKey, OutfitItem[]>();
  for (const it of result.items) {
    const arr = byCategory.get(it.category as OutfitCategoryKey) ?? [];
    arr.push(it);
    byCategory.set(it.category as OutfitCategoryKey, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 시간대 선택 — 상단 */}
      <PeriodPicker value={selection} onChange={setSelection} size="expanded" />

      {/* 2단: 좌(날씨+의상+팁) | 우(일러스트) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(0,300px)]">
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* 날씨 (위) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {config.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {activityIcon(config.activity)} {activityLabel(config.activity)} ·{" "}
                {snap.periodLabel}
                {!snap.fromHourly ? " · 현재 날씨 기준" : ""}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="font-mono text-3xl font-semibold tabular-nums leading-none text-foreground">
                  {Math.round(snap.feelsLike)}°
                </span>
                <div className="text-xs text-muted-foreground">
                  체감 · {result.layerLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={refresh}
                className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                새로고침
              </button>
            </div>
          </div>

          {/* 위험 경고 */}
          {result.dangerReasons.length > 0 ? (
            <div
              role="alert"
              className={[
                "flex flex-col gap-1 rounded-[var(--radius)] border p-3 text-sm",
                result.dangerLevel === "cancel" ||
                result.dangerLevel === "warning"
                  ? "border-destructive/40 bg-destructive/10 text-foreground"
                  : "border-border bg-card/40 text-foreground",
              ].join(" ")}
            >
              {result.cancelActivity ? (
                <p className="text-sm font-semibold text-destructive">
                  ⚠ 야외활동을 중단/연기하는 것이 안전합니다.
                </p>
              ) : null}
              {result.dangerReasons.map((r, i) => (
                <p
                  key={i}
                  className="text-xs leading-relaxed text-muted-foreground"
                >
                  {r}
                </p>
              ))}
            </div>
          ) : null}

          {/* 의상 설명 — 카테고리별 */}
          <div className="flex flex-col gap-3">
            {CATEGORY_ORDER.map((cat) => {
              const items = byCategory.get(cat);
              if (!items || items.length === 0) return null;
              return (
                <section key={cat} className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-medium text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {items.map((it) => (
                      <li
                        key={it.id}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm",
                          it.required
                            ? "border-primary/40 bg-primary/5 text-foreground"
                            : "border-border bg-card/40 text-foreground",
                        ].join(" ")}
                        title={it.condition}
                      >
                        <span aria-hidden>{it.icon}</span>
                        <span>{it.name}</span>
                        {it.activityTag ? (
                          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {it.activityTag}
                          </span>
                        ) : it.required ? (
                          <span className="text-[10px] text-primary">필수</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            선택
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          {/* 미기후 노트 */}
          {result.microclimateNote ? (
            <p className="rounded-[var(--radius)] border border-border bg-card/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {result.microclimateNote}
            </p>
          ) : null}

          {/* 팁 */}
          {result.tips.length > 0 ? (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">팁</h3>
              <ul className="flex flex-col gap-1">
                {result.tips.map((t, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-xs leading-relaxed text-foreground"
                  >
                    <span aria-hidden className="text-muted-foreground">
                      •
                    </span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-[11px] text-muted-foreground">
            {data.provider === "kma"
              ? "기상청(KMA) 예보 기반"
              : "Open-Meteo 예보 기반(근사치)"}
            {" · 미세먼지/오존 정보는 미반영"}
          </p>
        </div>

        {/* RIGHT: 일러스트 (넓은 화면에선 상단 고정) */}
        <div>
          <div className="lg:sticky lg:top-2">
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
              showLabel
              maxWidth={300}
              className="mx-auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default OutfitExpandedView;
