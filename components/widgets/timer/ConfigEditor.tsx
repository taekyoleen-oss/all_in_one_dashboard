"use client";

/**
 * timer · ConfigEditor — default mode, durations, sound/notify (타이머).
 *
 *  Reports the whole next config via onChange (parent persists). The running
 *  state is NOT here (it lives per-instance in localStorage).
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { requestNotifyPermission } from "./format";
import type { TimerConfig, TimerMode, PomodoroSettings } from "./types";

const MODES: Array<{ value: TimerMode; label: string }> = [
  { value: "timer", label: "타이머" },
  { value: "stopwatch", label: "스톱워치" },
  { value: "pomodoro", label: "뽀모도로" },
];

const numCls =
  "w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TimerConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<TimerConfig>) {
  const setPomo = (fields: Partial<PomodoroSettings>) =>
    onChange({ ...config, pomodoro: { ...config.pomodoro, ...fields } });

  return (
    <div className="flex flex-col gap-4">
      {/* Default mode */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          기본 모드
        </legend>
        <div className="grid grid-cols-3 gap-1.5">
          {MODES.map((m) => {
            const active = config.mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...config, mode: m.value })}
                className={[
                  "rounded-md border px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-foreground hover:bg-accent/40",
                ].join(" ")}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Timer default minutes */}
      <label className="flex items-center justify-between gap-2 text-sm text-foreground">
        <span>타이머 기본 시간 (분)</span>
        <input
          type="number"
          min={1}
          value={Math.round(config.timerSeconds / 60)}
          onChange={(e) =>
            onChange({
              ...config,
              timerSeconds: Math.max(1, Number(e.target.value) || 1) * 60,
            })
          }
          className={numCls}
        />
      </label>

      {/* Pomodoro durations */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          뽀모도로 (분)
        </legend>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center justify-between gap-2 text-sm text-foreground">
            집중
            <input
              type="number"
              min={1}
              value={config.pomodoro.workMin}
              onChange={(e) => setPomo({ workMin: Math.max(1, Number(e.target.value) || 1) })}
              className={numCls}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-foreground">
            짧은 휴식
            <input
              type="number"
              min={1}
              value={config.pomodoro.shortBreakMin}
              onChange={(e) =>
                setPomo({ shortBreakMin: Math.max(1, Number(e.target.value) || 1) })
              }
              className={numCls}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-foreground">
            긴 휴식
            <input
              type="number"
              min={1}
              value={config.pomodoro.longBreakMin}
              onChange={(e) =>
                setPomo({ longBreakMin: Math.max(1, Number(e.target.value) || 1) })
              }
              className={numCls}
            />
          </label>
          <label className="flex items-center justify-between gap-2 text-sm text-foreground">
            긴 휴식 주기
            <input
              type="number"
              min={1}
              value={config.pomodoro.longEvery}
              onChange={(e) =>
                setPomo({ longEvery: Math.max(1, Number(e.target.value) || 1) })
              }
              className={numCls}
            />
          </label>
        </div>
      </fieldset>

      {/* Sound / notify */}
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={config.sound}
          onChange={(e) => onChange({ ...config, sound: e.target.checked })}
          className="size-4 accent-[var(--primary)]"
        />
        종료 시 소리
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={config.notify}
          onChange={async (e) => {
            const on = e.target.checked;
            if (on) await requestNotifyPermission();
            onChange({ ...config, notify: on });
          }}
          className="size-4 accent-[var(--primary)]"
        />
        종료 시 브라우저 알림
      </label>
    </div>
  );
}

export default TimerConfigEditor;
