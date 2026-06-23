"use client";

/**
 * timer · TimerPanel — shared 타이머/스톱워치/뽀모도로 UI (CompactView + ExpandedView).
 *
 *  Mode tabs, a big monospace clock with a progress ring, and contextual controls
 *  (시작 / 일시정지 / 계속 / 정지 / 다음 단계). Pomodoro shows the current phase + a
 *  round dot strip. State + ticking come from useTimer (instance-scoped).
 */

import * as React from "react";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import { useTimer, type PomoPhase } from "./useTimer";
import { formatClock, formatStopwatch, requestNotifyPermission } from "./format";
import { TIMER_PRESETS, type TimerConfig, type TimerMode } from "./types";

const MODE_LABEL: Record<TimerMode, string> = {
  timer: "타이머",
  stopwatch: "스톱워치",
  pomodoro: "뽀모도로",
};

const PHASE_LABEL: Record<PomoPhase, string> = {
  work: "집중",
  short: "짧은 휴식",
  long: "긴 휴식",
};

const PHASE_TONE: Record<PomoPhase, string> = {
  work: "text-primary",
  short: "text-emerald-600 dark:text-emerald-400",
  long: "text-sky-600 dark:text-sky-400",
};

function btnPrimary(big: boolean): string {
  return `inline-flex items-center justify-center gap-1.5 rounded-md bg-primary ${
    big ? "px-5 py-2.5 text-base" : "px-3 py-1.5 text-sm"
  } font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring`;
}
function btnGhost(big: boolean): string {
  return `inline-flex items-center justify-center gap-1.5 rounded-md border border-border ${
    big ? "px-4 py-2.5 text-base" : "px-3 py-1.5 text-sm"
  } font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring`;
}

export function TimerPanel({
  config,
  instanceId,
  size = "compact",
}: {
  config: TimerConfig;
  instanceId: string;
  size?: "compact" | "expanded";
}) {
  const t = useTimer(instanceId, config);
  const big = size === "expanded";

  const display =
    t.mode === "stopwatch" ? formatStopwatch(t.displayMs) : formatClock(t.displayMs);
  const progress =
    t.totalMs > 0 ? Math.min(1, Math.max(0, 1 - t.displayMs / t.totalMs)) : 0;

  const onStart = () => {
    if (config.notify) void requestNotifyPermission();
    t.start();
  };

  return (
    <div className="flex h-full w-full flex-col items-center gap-2">
      {/* Mode tabs */}
      <div className="flex w-full shrink-0 gap-1">
        {(["timer", "stopwatch", "pomodoro"] as TimerMode[]).map((m) => {
          const active = t.mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => t.setMode(m)}
              className={[
                "flex-1 rounded-md border px-1.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent/40",
              ].join(" ")}
            >
              {MODE_LABEL[m]}
            </button>
          );
        })}
      </div>

      {/* Pomodoro phase + rounds */}
      {t.mode === "pomodoro" ? (
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className={`font-medium ${PHASE_TONE[t.pomoPhase]}`}>
            {PHASE_LABEL[t.pomoPhase]}
          </span>
          <span className="flex items-center gap-1" aria-label={`완료 ${t.pomoRound}회`}>
            {Array.from({ length: config.pomodoro.longEvery }).map((_, i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full ${
                  i < t.pomoRound % config.pomodoro.longEvery ||
                  (t.pomoRound > 0 && t.pomoRound % config.pomodoro.longEvery === 0)
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            ))}
          </span>
        </div>
      ) : null}

      {/* Clock with progress ring */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Ring progress={progress} size={big ? 200 : 116} active={t.mode !== "stopwatch"}>
          <span
            className={`font-mono font-semibold tabular-nums ${
              big ? "text-5xl" : "text-2xl @[200px]/widget:text-3xl"
            } ${t.status === "done" ? "text-positive" : "text-foreground"}`}
          >
            {display}
          </span>
          {t.status === "done" ? (
            <span className="mt-1 text-xs font-medium text-positive">완료!</span>
          ) : null}
        </Ring>
      </div>

      {/* Timer presets (only in idle timer mode) */}
      {t.mode === "timer" && t.status === "idle" ? (
        <div className="flex shrink-0 flex-wrap justify-center gap-1">
          {TIMER_PRESETS.map((p) => (
            <button
              key={p.seconds}
              type="button"
              onClick={() => t.setTimerSeconds(p.seconds)}
              className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {p.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-2">
        {t.status === "running" ? (
          <button type="button" onClick={t.pause} className={btnPrimary(big)}>
            <Pause size={big ? 18 : 15} aria-hidden /> 일시정지
          </button>
        ) : t.status === "done" && t.mode === "pomodoro" ? (
          <button type="button" onClick={t.next} className={btnPrimary(big)}>
            <SkipForward size={big ? 18 : 15} aria-hidden /> 다음 단계
          </button>
        ) : (
          <button type="button" onClick={onStart} className={btnPrimary(big)}>
            <Play size={big ? 18 : 15} aria-hidden />
            {t.status === "paused" ? "계속" : "시작"}
          </button>
        )}
        <button
          type="button"
          onClick={t.reset}
          aria-label="정지/초기화"
          className={btnGhost(big)}
        >
          <RotateCcw size={big ? 18 : 15} aria-hidden />
          {big ? "정지" : ""}
        </button>
      </div>
    </div>
  );
}

/** Circular progress ring around the clock (countdown modes). */
function Ring({
  progress,
  size,
  active,
  children,
}: {
  progress: number;
  size: number;
  active: boolean;
  children: React.ReactNode;
}) {
  const stroke = size < 140 ? 5 : 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {active ? (
        <svg
          width={size}
          height={size}
          className="absolute inset-0 -rotate-90"
          aria-hidden
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.25s linear" }}
          />
        </svg>
      ) : null}
      <div className="flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

export default TimerPanel;
