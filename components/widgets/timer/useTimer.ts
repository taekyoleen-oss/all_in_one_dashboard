"use client";

/**
 * useTimer — drives 타이머 / 스톱워치 / 뽀모도로 for one instance.
 *
 *  Design notes:
 *   • Absolute timestamps. Running countdowns store an `endAt` epoch (not a
 *     decrementing counter), and the stopwatch stores `startAt` + accumulated ms.
 *     So the display is always recomputed from the wall clock — no drift, and it
 *     stays correct across tab-switches / remounts.
 *   • Volatile runtime lives in localStorage keyed by instanceId (NOT in the
 *     synced config) — a running timer survives a remount without DB writes, and
 *     two instances are independent (격리).
 *   • On finish: optional beep + browser notification, then status → 'done'.
 *     Pomodoro exposes next() to advance work→break→work.
 */

import * as React from "react";
import type { TimerConfig, TimerMode } from "./types";
import { playBeep, notify } from "./format";

export type TimerStatus = "idle" | "running" | "paused" | "done";
export type PomoPhase = "work" | "short" | "long";

interface Runtime {
  mode: TimerMode;
  status: TimerStatus;
  /** Current block length, ms (timer/pomodoro). */
  durationMs: number;
  /** Epoch ms the countdown hits 0 (only while running). */
  endAt: number | null;
  /** Remaining ms when paused. */
  remainingMs: number;
  /** Stopwatch: epoch ms it (re)started, only while running. */
  swStartAt: number | null;
  /** Stopwatch: accumulated ms while paused/stopped. */
  swAccumMs: number;
  /** Pomodoro current phase + completed work-block count. */
  pomoPhase: PomoPhase;
  pomoRound: number;
}

function storageKey(instanceId: string): string {
  return `pb:timer:${instanceId}`;
}

function phaseDuration(config: TimerConfig, phase: PomoPhase): number {
  const p = config.pomodoro;
  const min =
    phase === "work" ? p.workMin : phase === "short" ? p.shortBreakMin : p.longBreakMin;
  return Math.max(1, Math.round(min)) * 60_000;
}

function initialRuntime(config: TimerConfig): Runtime {
  return {
    mode: config.mode,
    status: "idle",
    durationMs:
      config.mode === "pomodoro"
        ? phaseDuration(config, "work")
        : config.timerSeconds * 1000,
    endAt: null,
    remainingMs:
      config.mode === "pomodoro"
        ? phaseDuration(config, "work")
        : config.timerSeconds * 1000,
    swStartAt: null,
    swAccumMs: 0,
    pomoPhase: "work",
    pomoRound: 0,
  };
}

function load(instanceId: string, config: TimerConfig): Runtime {
  if (typeof window === "undefined") return initialRuntime(config);
  try {
    const raw = window.localStorage.getItem(storageKey(instanceId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Runtime>;
      if (parsed && typeof parsed.status === "string") {
        return { ...initialRuntime(config), ...parsed } as Runtime;
      }
    }
  } catch {
    /* ignore corrupt state */
  }
  return initialRuntime(config);
}

export interface TimerView {
  mode: TimerMode;
  status: TimerStatus;
  /** Display ms — remaining (timer/pomodoro) or elapsed (stopwatch). */
  displayMs: number;
  /** Total block ms (for the progress ring); 0 for stopwatch. */
  totalMs: number;
  pomoPhase: PomoPhase;
  pomoRound: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  next: () => void;
  setMode: (mode: TimerMode) => void;
  setTimerSeconds: (seconds: number) => void;
}

export function useTimer(instanceId: string, config: TimerConfig): TimerView {
  const [rt, setRt] = React.useState<Runtime>(() => load(instanceId, config));
  // A ticking 'now' only while something is running (else no re-render churn).
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  const finishedRef = React.useRef(false);

  // Persist runtime on every change.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey(instanceId), JSON.stringify(rt));
    } catch {
      /* quota — non-fatal */
    }
  }, [instanceId, rt]);

  // Tick while running.
  React.useEffect(() => {
    if (rt.status !== "running") return;
    const interval = rt.mode === "stopwatch" ? 50 : 250;
    const id = window.setInterval(force, interval);
    return () => window.clearInterval(id);
  }, [rt.status, rt.mode]);

  // Compute display.
  const now = Date.now();
  let displayMs: number;
  let totalMs: number;
  if (rt.mode === "stopwatch") {
    displayMs =
      rt.status === "running" && rt.swStartAt !== null
        ? rt.swAccumMs + (now - rt.swStartAt)
        : rt.swAccumMs;
    totalMs = 0;
  } else {
    totalMs = rt.durationMs;
    displayMs =
      rt.status === "running" && rt.endAt !== null
        ? rt.endAt - now
        : rt.status === "done"
          ? 0
          : rt.remainingMs;
  }

  // Detect countdown completion (timer/pomodoro).
  React.useEffect(() => {
    if (rt.mode === "stopwatch") return;
    if (rt.status !== "running" || rt.endAt === null) {
      finishedRef.current = false;
      return;
    }
    const fireAt = rt.endAt;
    const ms = fireAt - Date.now();
    if (ms <= 0) {
      handleFinish();
      return;
    }
    const id = window.setTimeout(handleFinish, ms + 30);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt.status, rt.endAt, rt.mode]);

  const handleFinish = React.useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setRt((s) => ({ ...s, status: "done", endAt: null, remainingMs: 0 }));
    if (config.sound) playBeep();
    if (config.notify) {
      notify(
        "⏰ 시간 종료",
        config.mode === "pomodoro" ? "다음 단계로 넘어가세요." : "타이머가 끝났습니다.",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.sound, config.notify, config.mode]);

  /* ------------------------------- actions ------------------------------- */

  const start = React.useCallback(() => {
    finishedRef.current = false;
    setRt((s) => {
      if (s.mode === "stopwatch") {
        return { ...s, status: "running", swStartAt: Date.now() };
      }
      const remaining = s.status === "paused" ? s.remainingMs : s.durationMs;
      const useRemaining = s.status === "done" ? s.durationMs : remaining;
      return {
        ...s,
        status: "running",
        endAt: Date.now() + useRemaining,
        remainingMs: useRemaining,
      };
    });
  }, []);

  const pause = React.useCallback(() => {
    setRt((s) => {
      if (s.status !== "running") return s;
      if (s.mode === "stopwatch") {
        const accum =
          s.swStartAt !== null ? s.swAccumMs + (Date.now() - s.swStartAt) : s.swAccumMs;
        return { ...s, status: "paused", swStartAt: null, swAccumMs: accum };
      }
      const remaining = s.endAt !== null ? Math.max(0, s.endAt - Date.now()) : s.remainingMs;
      return { ...s, status: "paused", endAt: null, remainingMs: remaining };
    });
  }, []);

  const reset = React.useCallback(() => {
    finishedRef.current = false;
    setRt((s) => {
      if (s.mode === "stopwatch") {
        return { ...s, status: "idle", swStartAt: null, swAccumMs: 0 };
      }
      const dur =
        s.mode === "pomodoro" ? phaseDuration(config, s.pomoPhase) : config.timerSeconds * 1000;
      return { ...s, status: "idle", endAt: null, durationMs: dur, remainingMs: dur };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const next = React.useCallback(() => {
    finishedRef.current = false;
    setRt((s) => {
      if (s.mode !== "pomodoro") return s;
      let phase: PomoPhase;
      let round = s.pomoRound;
      if (s.pomoPhase === "work") {
        round = s.pomoRound + 1;
        phase = round % Math.max(1, config.pomodoro.longEvery) === 0 ? "long" : "short";
      } else {
        phase = "work";
      }
      const dur = phaseDuration(config, phase);
      return {
        ...s,
        status: "idle",
        pomoPhase: phase,
        pomoRound: round,
        durationMs: dur,
        remainingMs: dur,
        endAt: null,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const setMode = React.useCallback(
    (mode: TimerMode) => {
      finishedRef.current = false;
      setRt(() => ({ ...initialRuntime({ ...config, mode }), mode }));
    },
    [config],
  );

  const setTimerSeconds = React.useCallback((seconds: number) => {
    finishedRef.current = false;
    const ms = Math.max(1, Math.round(seconds)) * 1000;
    setRt((s) => ({
      ...s,
      status: "idle",
      durationMs: ms,
      remainingMs: ms,
      endAt: null,
    }));
  }, []);

  return {
    mode: rt.mode,
    status: rt.status,
    displayMs: Math.max(0, displayMs),
    totalMs,
    pomoPhase: rt.pomoPhase,
    pomoRound: rt.pomoRound,
    start,
    pause,
    reset,
    next,
    setMode,
    setTimerSeconds,
  };
}

export default useTimer;
