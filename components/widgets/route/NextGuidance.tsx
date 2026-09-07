"use client";

/**
 * NextGuidance — "230m 앞 좌회전" 배너(요구 2, 전체보기 전용).
 *
 *  큰 글씨 한 줄은 turnType에서 뽑은 짧은 방향 라벨이고, 그 아래에 서버가 준
 *  한국어 안내(`description`)를 그대로 보여준다. 모르는 turnType이면 라벨 대신
 *  description만 쓴다 — 코드표가 불완전해도 안내가 죽지 않도록.
 *
 *  ⚠ 정직성: 경로에서 벗어났으면 방향을 **말하지 않는다.** 틀린 방향을 자신 있게
 *  안내하는 것이 이 위젯이 할 수 있는 최악의 일이다. 대신 얼마나 벗어났는지 알린다.
 */

import * as React from "react";
import {
  ArrowDownLeft,
  Ban,
  ArrowDownRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Milestone,
  RotateCcw,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { WalkStep } from "@/output/api-shapes";
import { formatDistance } from "@/lib/widgets/route/geo";
import { turnLabel } from "@/lib/widgets/route/guidance";

/** turnType → 화살표. 표에 없으면 Milestone(일반 안내점)으로 폴백한다. */
const TURN_ICONS: Record<number, LucideIcon> = {
  11: ArrowUp,
  233: ArrowUp,
  12: CornerUpLeft,
  13: CornerUpRight,
  14: RotateCcw,
  16: ArrowDownLeft,
  17: ArrowUpLeft,
  18: ArrowUpRight,
  19: ArrowDownRight,
  201: Flag,
};

function TurnIcon({ turnType, size }: { turnType: number; size: number }) {
  const Icon = TURN_ICONS[turnType] ?? Milestone;
  return <Icon size={size} aria-hidden className="shrink-0" />;
}

/** 배너 한 겹 — 상태별로 색만 다르고 구조는 같다. */
function Banner({
  tone,
  icon,
  headline,
  detail,
  action,
}: {
  tone: "normal" | "warn" | "done";
  icon: React.ReactNode;
  headline: string;
  detail?: string | null;
  action?: React.ReactNode;
}) {
  const toneClass =
    tone === "warn"
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : tone === "done"
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border bg-accent/30 text-foreground";
  return (
    <div
      className={`flex shrink-0 items-center gap-3 rounded-md border px-3 py-2 ${toneClass}`}
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold leading-tight">{headline}</p>
        {detail ? (
          <p className="truncate text-xs leading-tight opacity-80">{detail}</p>
        ) : null}
      </div>
      {action ? <span className="shrink-0">{action}</span> : null}
    </div>
  );
}

/** '경로 다시 계산' — 자동 재계산을 하지 않으므로(계획서 §3) 수동 출구가 필요하다. */
function RerouteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-current/40 px-2 py-1 text-xs font-medium outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:px-3 pointer-coarse:py-2"
    >
      <RotateCcw size={13} aria-hidden />
      다시 계산
    </button>
  );
}

/** 자동 재검색을 이번 이탈에 한해 막는다. */
function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border border-current/40 px-2 py-1 text-xs font-medium outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:px-3 pointer-coarse:py-2"
    >
      <Ban size={13} aria-hidden />
      취소
    </button>
  );
}

export function NextGuidance({
  step,
  toStep,
  toEnd,
  arrived,
  offRouteBy,
  onReroute,
  canReroute,
  autoPending,
  onCancelAuto,
}: {
  step: WalkStep | null;
  toStep: number;
  toEnd: number;
  arrived: boolean;
  /** 경로에서 벗어난 거리(m). 경로 위면 null. */
  offRouteBy: number | null;
  /** 현재 위치에서 경로를 다시 계산한다. */
  onReroute: () => void;
  /**
   * 다시 계산이 의미가 있는가 — 출발지가 '현재 위치'일 때만 결과가 달라진다.
   * 출발지를 직접 지정한 위젯은 다시 계산해도 같은 경로라 버튼을 숨긴다
   * (누르면 아무 일도 안 일어나는 버튼을 두지 않는다).
   */
  canReroute: boolean;
  /** 자동 재검색이 예약된 상태인가. */
  autoPending: boolean;
  /** 이번 이탈의 자동 재검색을 취소한다. */
  onCancelAuto: () => void;
}) {
  if (offRouteBy !== null) {
    // 자동 재검색이 걸려 있으면 그 사실과 '취소'를 먼저 보여준다 — 일부러 다른
    // 길로 가는 중일 수 있으므로 사용자가 막을 수 있어야 한다.
    const near = `경로까지 약 ${formatDistance(offRouteBy)}`;
    const detail = autoPending
      ? `${near} · 잠시 후 자동으로 다시 찾습니다`
      : canReroute
        ? `${near} · 자동 재검색을 취소했습니다`
        : `${near} · 경로로 돌아가면 안내가 다시 시작됩니다`;
    return (
      <Banner
        tone="warn"
        icon={<TriangleAlert size={26} aria-hidden />}
        headline="경로에서 벗어났습니다"
        detail={detail}
        action={
          canReroute ? (
            <span className="flex shrink-0 items-center gap-1">
              {autoPending ? <CancelButton onClick={onCancelAuto} /> : null}
              <RerouteButton onClick={onReroute} />
            </span>
          ) : undefined
        }
      />
    );
  }

  if (arrived) {
    return (
      <Banner
        tone="done"
        icon={<Flag size={26} aria-hidden />}
        headline="도착했습니다"
        detail="목적지 부근입니다"
      />
    );
  }

  if (!step) {
    return (
      <Banner
        tone="normal"
        icon={<ArrowUp size={26} aria-hidden />}
        headline={`${formatDistance(toEnd)} 앞 도착`}
        detail="남은 구간은 직진입니다"
      />
    );
  }

  const label = turnLabel(step.turnType);
  return (
    <Banner
      tone="normal"
      icon={<TurnIcon turnType={step.turnType} size={26} />}
      // 라벨을 모르면 거리만 크게 쓰고 안내는 아래 줄에 맡긴다.
      headline={label ? `${formatDistance(toStep)} 앞 ${label}` : `${formatDistance(toStep)} 앞`}
      detail={step.description || step.name || null}
    />
  );
}

export default NextGuidance;
