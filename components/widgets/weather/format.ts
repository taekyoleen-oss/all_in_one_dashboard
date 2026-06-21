/**
 * weather widget — condition → icon + label, plus °C / time formatting (설계서 §2.1).
 *
 *  Each source-neutral WeatherCondition (from output/api-shapes.ts) maps to BOTH
 *  a lucide icon AND a Korean text label, so the condition is never conveyed by
 *  an icon (or color) alone — there is always a readable word (접근성).
 */

import * as React from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudHail,
  CloudLightning,
  CloudFog,
  HelpCircle,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import type { WeatherCondition } from "@/output/api-shapes";

interface ConditionMeta {
  Icon: LucideIcon;
  label: string;
  /** Tailwind text-color for a COLORED icon (요구: 날씨 아이콘 컬러). */
  color: string;
}

const CONDITION_META: Record<WeatherCondition, ConditionMeta> = {
  clear: { Icon: Sun, label: "맑음", color: "text-amber-400" },
  "partly-cloudy": { Icon: CloudSun, label: "구름 조금", color: "text-amber-300" },
  cloudy: { Icon: Cloud, label: "흐림", color: "text-slate-400" },
  rain: { Icon: CloudRain, label: "비", color: "text-sky-500" },
  snow: { Icon: CloudSnow, label: "눈", color: "text-sky-300" },
  sleet: { Icon: CloudHail, label: "진눈깨비", color: "text-cyan-400" },
  thunderstorm: { Icon: CloudLightning, label: "뇌우", color: "text-violet-400" },
  fog: { Icon: CloudFog, label: "안개", color: "text-slate-300" },
  unknown: { Icon: HelpCircle, label: "정보 없음", color: "text-muted-foreground" },
};

export function conditionLabel(condition: WeatherCondition): string {
  return CONDITION_META[condition].label;
}

/** Tailwind text-color class for a condition's colored icon. */
export function conditionColor(condition: WeatherCondition): string {
  return CONDITION_META[condition].color;
}

/**
 * Render the icon for a condition. A module-scope component (not derived inside
 * render) so it satisfies react-hooks/static-components, while keeping the
 * condition→icon mapping in one place. Falls back to a labelled aria when no
 * explicit `aria-label` is passed (the views also show the text label, so the
 * icon is decorative — `aria-hidden` is the common case).
 */
export function ConditionIcon({
  condition,
  className,
  ...props
}: { condition: WeatherCondition } & LucideProps): React.ReactElement {
  const meta = CONDITION_META[condition];
  // Drop any caller-forced text color (e.g. text-foreground) and apply the
  // condition color LAST so the colored icon always wins; keep layout classes.
  const layout = (className ?? "")
    .split(/\s+/)
    .filter((c) => c && !c.startsWith("text-"))
    .join(" ");
  const cls = [layout, meta.color].join(" ").trim();
  return React.createElement(meta.Icon, { ...props, className: cls });
}

/** Round to a whole degree and append °C (e.g. 21.4 → "21°"). */
export function formatTemp(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

/** Hour label for the hourly strip (e.g. "15시"). */
export function formatHour(ts: number): string {
  const h = new Date(ts).getHours();
  return `${h}시`;
}

/** Weekday label for the daily list (e.g. "월"); "오늘" for today. */
export function formatDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "오늘";
  return d.toLocaleDateString("ko-KR", { weekday: "short" });
}

/** Probability-of-precipitation label, or null when not provided. */
export function formatPop(pop: number | undefined): string | null {
  if (typeof pop !== "number" || !Number.isFinite(pop)) return null;
  return `${Math.round(pop)}%`;
}
