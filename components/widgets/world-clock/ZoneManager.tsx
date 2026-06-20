"use client";

/**
 * world-clock · ZoneManager — add / remove / reorder IANA zones (설계서 §2.2).
 *
 *  Controlled: reports the whole next config via onChange (the ConfigEditor wires
 *  this to the dialog draft). Reorder uses up/down buttons so it's fully
 *  keyboard-operable (no drag dependency). New zones can be picked from the
 *  curated list or entered as a free-text IANA id (validated via Intl).
 */

import * as React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import {
  COMMON_ZONES,
  isValidTimeZone,
  type ClockZone,
  type WorldClockConfig,
} from "./types";

function newZoneId(tz: string): string {
  const base = tz.split("/").pop()?.toLowerCase().replace(/\W+/g, "") || "zone";
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 4)
      : Math.random().toString(36).slice(2, 6);
  return `${base}-${rand}`;
}

export function ZoneManager({
  config,
  onChange,
}: {
  config: WorldClockConfig;
  onChange: (next: WorldClockConfig) => void;
}) {
  const [tzInput, setTzInput] = React.useState("");
  const [labelInput, setLabelInput] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const setZones = (zones: ClockZone[]) => onChange({ ...config, zones });

  const move = (index: number, dir: -1 | 1) => {
    const next = [...config.zones];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setZones(next);
  };

  const remove = (id: string) =>
    setZones(config.zones.filter((z) => z.id !== id));

  const add = () => {
    const tz = tzInput.trim();
    if (!isValidTimeZone(tz)) {
      setErr("유효한 IANA 시간대가 아닙니다 (예: Asia/Seoul).");
      return;
    }
    const label =
      labelInput.trim() ||
      COMMON_ZONES.find((c) => c.timeZone === tz)?.label ||
      (tz.split("/").pop() ?? tz).replace(/_/g, " ");
    setZones([...config.zones, { id: newZoneId(tz), timeZone: tz, label }]);
    setTzInput("");
    setLabelInput("");
    setErr(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Existing zones */}
      <ul className="flex flex-col gap-1.5">
        {config.zones.map((z, i) => (
          <li
            key={z.id}
            className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {z.label}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {z.timeZone}
              </span>
            </div>
            <button
              type="button"
              aria-label={`${z.label} 위로`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              aria-label={`${z.label} 아래로`}
              disabled={i === config.zones.length - 1}
              onClick={() => move(i, 1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowDown size={15} />
            </button>
            <button
              type="button"
              aria-label={`${z.label} 삭제`}
              onClick={() => remove(z.id)}
              className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {config.zones.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            추가된 시간대가 없습니다.
          </li>
        ) : null}
      </ul>

      {/* Add a new zone */}
      <div className="flex flex-col gap-2 rounded-md border border-border p-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          시간대 (IANA)
          <input
            list="pb-tz-list"
            value={tzInput}
            onChange={(e) => setTzInput(e.target.value)}
            placeholder="Asia/Seoul"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <datalist id="pb-tz-list">
            {COMMON_ZONES.map((c) => (
              <option key={c.timeZone} value={c.timeZone}>
                {c.label}
              </option>
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          라벨 (선택)
          <input
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            placeholder="서울"
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        {err ? <p className="text-xs text-destructive">{err}</p> : null}
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus size={15} aria-hidden />
          시간대 추가
        </button>
      </div>
    </div>
  );
}

export default ZoneManager;
