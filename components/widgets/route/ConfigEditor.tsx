"use client";

/**
 * route · ConfigEditor — 출발지·도착지·이동 목적·계단 회피 설정.
 *
 *  위치 지정 UI는 공용 `LocationPicker`를 그대로 재사용한다(주소·장소 검색 / 현재
 *  위치 / 지역 / 직접 입력). 출발지는 기본이 '현재 위치'이고, 체크를 풀 때만
 *  피커가 열린다 — 두 피커를 늘 펼쳐 두면 다이얼로그가 지나치게 길어진다.
 *
 *  onChange로 전체 config를 보고하고 영속화는 상위(ConfigDialog)가 한다.
 */

import * as React from "react";
import { LocationPicker } from "@/components/widgets/shared/LocationPicker";
import { rememberPlace } from "@/lib/widgets/route/places";
import {
  PURPOSES,
  purposeOf,
  stairsFixedBy,
} from "@/lib/widgets/route/purpose";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import type { RouteConfig, RoutePlace } from "./types";

/** 피커에 넘길 기본값 — 아직 고르지 않았을 때의 자리표시(서울시청). */
const PLACEHOLDER: RoutePlace = { label: "", lat: 37.5665, lon: 126.978 };

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{title}</legend>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

export function RouteConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<RouteConfig>) {
  const useCurrent = config.start === null;
  const purpose = purposeOf(config.purpose);
  // 등산·강변은 목적이 계단 옵션을 이미 정한다 — 체크박스를 살려 두면 거짓말이 된다.
  const stairsLocked = stairsFixedBy(purpose.key);

  return (
    <div className="flex flex-col gap-4">
      <Section title="출발지">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={useCurrent}
            onChange={(e) =>
              onChange({
                ...config,
                // 체크 해제 시엔 곧바로 고를 수 있도록 도착지 근처가 아닌 빈 값을 둔다.
                start: e.target.checked ? null : { ...PLACEHOLDER, label: "출발지" },
              })
            }
            className="size-4 accent-[var(--primary)]"
          />
          현재 위치에서 출발
        </label>
        {useCurrent ? (
          <p className="text-xs text-muted-foreground">
            기기 위치 권한이 필요합니다. 거부되면 여기서 출발지를 직접 지정하세요.
          </p>
        ) : (
          <LocationPicker
            value={config.start ?? PLACEHOLDER}
            onPick={(loc) => {
              // 여기서 고른 곳도 위젯 안 피커의 '최근 검색'에 함께 쌓인다.
              rememberPlace(loc);
              onChange({ ...config, start: loc });
            }}
          />
        )}
      </Section>

      <Section title="도착지" hint={config.end ? undefined : "도착지를 지정해야 경로가 표시됩니다."}>
        <LocationPicker
          value={config.end ?? PLACEHOLDER}
          onPick={(loc) => {
            rememberPlace(loc);
            onChange({ ...config, end: loc });
          }}
        />
      </Section>

      <Section
        title="이동 목적"
        hint="목적에 따라 티맵 경로 옵션과 결과 표시가 함께 바뀝니다."
      >
        <div className="flex flex-wrap gap-1.5">
          {PURPOSES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange({ ...config, purpose: p.key })}
              aria-pressed={p.key === purpose.key}
              className={`rounded-md border px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                p.key === purpose.key
                  ? "border-primary bg-primary/10 font-medium text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {purpose.hint}
        </p>
      </Section>

      <Section title="경로 옵션">
        <label
          className={`flex items-center gap-2 text-sm ${
            stairsLocked ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          <input
            type="checkbox"
            checked={config.avoidStairs}
            disabled={stairsLocked}
            onChange={(e) => onChange({ ...config, avoidStairs: e.target.checked })}
            className="size-4 accent-[var(--primary)] disabled:opacity-50"
          />
          계단 피하기
        </label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {stairsLocked
            ? `'${purpose.label}'이(가) 계단 처리를 이미 정합니다 — 이 설정은 '일반'일 때만 쓰입니다.`
            : "유모차·휠체어·짐이 있을 때. 대신 경로가 길어질 수 있습니다."}
        </p>
      </Section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        도보 경로는 티맵이 제공하며 <strong>전국이 지원되지는 않습니다</strong>(서울·수도권
        시지역·6대광역시·제주도 + 주요 시). 고도는 90m 해상도 지형 데이터 기반의 근사치라
        계단·육교는 반영되지 않습니다.
      </p>
    </div>
  );
}

export default RouteConfigEditor;
