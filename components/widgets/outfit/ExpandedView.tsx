"use client";

/**
 * 외출옷 추천 · ExpandedView — 전체 화면.
 *
 *  큰 일러스트 + 카테고리별 추천 아이템 목록 + 팁 + 위험 경고. 시간대를 바꾸면
 *  해당 시간 기준으로 즉시 다시 추천한다. 성별·활동·체감 보정은 설정에서 변경.
 */

import * as React from "react";
import type { ExpandedViewProps } from "@/lib/widgets/contract";
import { useOutfit } from "./useOutfit";
import { buildOutfitSnapshot } from "./weatherMap";
import { recommendOutfit } from "./illustration/recommender";
import { OutfitIllustration } from "./illustration/OutfitIllustration";
import { PeriodPicker } from "./PeriodPicker";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type OutfitCategoryKey,
} from "./illustration/categories";
import type { OutfitItem } from "./illustration/types";
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

export function OutfitExpandedView({ config }: ExpandedViewProps<OutfitConfig>) {
  const { data, loading, error, refresh } = useOutfit(config);
  const [periodId, setPeriodId] = React.useState<string>(
    config.periodId ?? currentPeriodId(),
  );
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

  // 카테고리별 그룹핑 (CATEGORY_ORDER 순서).
  const byCategory = new Map<OutfitCategoryKey, OutfitItem[]>();
  for (const it of result.items) {
    const arr = byCategory.get(it.category as OutfitCategoryKey) ?? [];
    arr.push(it);
    byCategory.set(it.category as OutfitCategoryKey, arr);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 시간대 선택 — 상단 */}
      <PeriodPicker value={periodId} onChange={setPeriodId} size="expanded" />

      {/* 헤더: 위치 · 활동 · 시간대 · 체감 */}
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
            result.dangerLevel === "cancel" || result.dangerLevel === "warning"
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
            <p key={i} className="text-xs leading-relaxed text-muted-foreground">
              {r}
            </p>
          ))}
        </div>
      ) : null}

      {/* 일러스트 + 아이템 목록 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_1fr]">
        <div className="flex items-start justify-center">
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
            maxWidth={240}
          />
        </div>

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

      <p className="text-right text-[11px] text-muted-foreground">
        {data.provider === "kma"
          ? "기상청(KMA) 예보 기반"
          : "Open-Meteo 예보 기반(근사치)"}
        {" · 미세먼지/오존 정보는 미반영"}
      </p>
    </div>
  );
}

export default OutfitExpandedView;
