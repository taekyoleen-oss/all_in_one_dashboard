/**
 * timer widget — config shape (타이머 / 스톱워치 / 뽀모도로).
 *
 *  config holds only PREFERENCES (default mode, durations, sound). The live
 *  running state (start/end timestamps, remaining ms) is volatile and kept in
 *  localStorage keyed by instanceId — NOT in the synced config — so a ticking
 *  timer survives a remount/tab-switch without spamming the DB. dataMode:'static'.
 */

export type TimerMode = "timer" | "stopwatch" | "pomodoro";

export interface PomodoroSettings {
  /** Work block length, minutes. */
  workMin: number;
  /** Short break length, minutes. */
  shortBreakMin: number;
  /** Long break length, minutes. */
  longBreakMin: number;
  /** Take a long break after this many work blocks. */
  longEvery: number;
}

export interface TimerConfig {
  /** Which mode the widget opens in. */
  mode: TimerMode;
  /** Default countdown length (seconds) for 타이머 mode. */
  timerSeconds: number;
  /** Pomodoro durations. */
  pomodoro: PomodoroSettings;
  /** Play a short beep when a timer/pomodoro block finishes. */
  sound: boolean;
  /** Show a browser notification on finish (asks permission once). */
  notify: boolean;
}

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  mode: "timer",
  timerSeconds: 300, // 5분
  pomodoro: { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 },
  sound: true,
  notify: false,
};

/** Common quick-pick durations for 타이머 mode (seconds). */
export const TIMER_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: "1분", seconds: 60 },
  { label: "3분", seconds: 180 },
  { label: "5분", seconds: 300 },
  { label: "10분", seconds: 600 },
  { label: "25분", seconds: 1500 },
];
