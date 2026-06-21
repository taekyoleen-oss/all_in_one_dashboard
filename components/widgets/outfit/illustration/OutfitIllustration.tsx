"use client";

/**
 * OutfitIllustration — 외출옷 추천 캐릭터 일러스트 (원본 OutfitHeroIllustration 이식).
 *
 *  원본 앱과 동일한 방식: 체감 구간·날씨 상황으로 캐릭터 webp 슬롯을 고르고
 *  (pickCharacterSlot), 반투명 날씨 데코 SVG(WeatherCharBg) 위에 `mix-blend-mode:
 *  darken`으로 합성한다. 캐릭터 PNG의 흰 배경이 뒤 SVG로 대체되어 자연스럽게 보인다.
 *
 *  PaneBoard에서는 next/image 대신 일반 <img>로 로컬 public 에셋을 직접 사용한다.
 */

import * as React from "react";
import type {
  GenderType,
  HeroIllustKey,
  OutfitWeatherSnapshot,
  TempZone,
} from "./types";
import { outfitCharacterImageSrc, pickCharacterSlot } from "./characterIllust";
import { WeatherCharBg, resolveWeatherBgMode } from "./WeatherCharBg";

/** 캐릭터 이미지 표준 비율 (686×1024로 크롭 통일) */
const CHAR_IMG_W = 686;
const CHAR_IMG_H = 1024;

const ILLUST_LABELS: Record<HeroIllustKey, string> = {
  "summer-light": "여름 가벼운 코디",
  "summer-sport": "여름 스포츠 코디",
  "spring-mild": "봄가을 선선한 코디",
  "fall-layered": "가을 레이어드 코디",
  "winter-heavy": "겨울 방한 코디",
  "rain-gear": "우천 대비 코디",
  "snow-gear": "눈·한파 코디",
  "beach-look": "해변 코디",
  "ski-look": "스키장 코디",
  "golf-look": "골프 코디",
};

function heroLabel(illustKey: HeroIllustKey, calendarMonth?: number): string {
  if (illustKey !== "fall-layered") return ILLUST_LABELS[illustKey];
  const m = calendarMonth;
  if (m === 3 || m === 4 || m === 5) return "봄 레이어드 코디";
  if (m === 9 || m === 10 || m === 11) return "가을 레이어드 코디";
  return ILLUST_LABELS["fall-layered"];
}

export interface OutfitIllustrationProps {
  illustKey: HeroIllustKey;
  gender: GenderType;
  tempZone: TempZone;
  weatherSky: OutfitWeatherSnapshot;
  precipitation?: number;
  windAlert?: boolean;
  showSunshine?: boolean;
  isNight?: boolean;
  calendarMonth?: number;
  /** 라벨(코디명)을 일러스트 아래 표시할지. */
  showLabel?: boolean;
  /** 프레임 최대 너비(px). 컨테이너에 맞춰 줄어든다. (fit=false일 때만) */
  maxWidth?: number;
  /**
   * 부모 박스 크기에 맞춰 가로·세로 모두로 축소(비율 유지). 타일을 줄이면 그림도 함께
   * 작아지도록 할 때 사용(요구). 부모는 높이·너비가 정해진 flex 박스여야 한다.
   */
  fit?: boolean;
  className?: string;
}

export function OutfitIllustration({
  illustKey,
  gender,
  tempZone,
  weatherSky,
  precipitation,
  windAlert,
  showSunshine,
  isNight,
  calendarMonth,
  showLabel = true,
  maxWidth = 240,
  fit = false,
  className,
}: OutfitIllustrationProps) {
  const label = heroLabel(illustKey, calendarMonth);

  const slot = pickCharacterSlot({
    tempZone,
    ptyCode: weatherSky.ptyCode,
    precipitation,
    showSunshine,
    windAlert,
  });
  const charSrc = outfitCharacterImageSrc(gender, slot);
  const altText =
    gender === "female"
      ? `여성 복장 일러스트 — ${label}`
      : `남성 복장 일러스트 — ${label}`;

  const bgMode = resolveWeatherBgMode({
    ptyCode: weatherSky.ptyCode,
    skyCode: weatherSky.skyCode,
    precipitation,
    showSunshine,
    windAlert,
    isNight,
  });

  const frameStyle = {
    // mix-blend-mode가 프레임 안에서만 합성되도록 격리 + 밝은 배경.
    isolation: "isolate" as const,
    background: "rgba(255,255,255,0.6)",
    border: "1px solid var(--border)",
    ...(fit ? {} : { maxWidth }),
  };

  return (
    <div
      className={[
        "flex min-h-0 min-w-0 flex-col items-center justify-center gap-1.5",
        fit ? "h-full w-full" : "",
        className ?? "",
      ].join(" ")}
    >
      <div
        className={
          fit
            ? // 부모 박스에 맞춰 너비·높이 모두로 축소(이미지가 비율 유지하며 fit).
              "relative flex min-h-0 max-h-full max-w-full items-center justify-center overflow-hidden rounded-2xl"
            : "relative flex w-full items-center justify-center overflow-hidden rounded-2xl"
        }
        style={frameStyle}
      >
        <WeatherCharBg
          mode={bgMode}
          className="absolute inset-0 h-full w-full pointer-events-none"
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- 로컬 public webp, blend 합성 필요 */}
        <img
          src={charSrc}
          alt={altText}
          width={CHAR_IMG_W}
          height={CHAR_IMG_H}
          className={
            fit
              ? "relative block h-auto max-h-full w-auto max-w-full"
              : "relative h-auto w-full max-w-full"
          }
          style={{ mixBlendMode: "darken" }}
          loading="lazy"
          decoding="async"
        />
      </div>
      {showLabel ? (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export default OutfitIllustration;
