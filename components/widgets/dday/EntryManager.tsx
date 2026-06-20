"use client";

/**
 * dday · EntryManager — add / edit / remove / reorder D-Day entries (설계서 §2.2).
 *
 *  Controlled: reports the whole next config via onChange. Each entry edits in
 *  place (label, date, repeat-yearly). Reorder via up/down buttons (keyboard-
 *  operable). New entries default to today's date.
 */

import * as React from "react";
import { format } from "date-fns";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { DDayConfig, DDayEntry } from "./types";

function newEntryId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `dday-${crypto.randomUUID().slice(0, 6)}`
    : `dday-${Math.random().toString(36).slice(2, 8)}`;
}

export function EntryManager({
  config,
  onChange,
}: {
  config: DDayConfig;
  onChange: (next: DDayConfig) => void;
}) {
  const setEntries = (entries: DDayEntry[]) => onChange({ ...config, entries });

  const patch = (id: string, fields: Partial<DDayEntry>) =>
    setEntries(config.entries.map((e) => (e.id === id ? { ...e, ...fields } : e)));

  const remove = (id: string) =>
    setEntries(config.entries.filter((e) => e.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...config.entries];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEntries(next);
  };

  const add = () => {
    setEntries([
      ...config.entries,
      {
        id: newEntryId(),
        label: "",
        date: format(new Date(), "yyyy-MM-dd"),
        repeatYearly: false,
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {config.entries.map((e, i) => (
          <li
            key={e.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2"
          >
            <div className="flex items-center gap-2">
              <input
                value={e.label}
                onChange={(ev) => patch(e.id, { label: ev.target.value })}
                placeholder="제목 (예: 프로젝트 마감)"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                aria-label={`${e.label || "항목"} 위로`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`${e.label || "항목"} 아래로`}
                disabled={i === config.entries.length - 1}
                onClick={() => move(i, 1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                aria-label={`${e.label || "항목"} 삭제`}
                onClick={() => remove(e.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={e.date}
                onChange={(ev) => patch(e.id, { date: ev.target.value })}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <label className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={e.repeatYearly}
                  onChange={(ev) => patch(e.id, { repeatYearly: ev.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                매년 반복
              </label>
            </div>
          </li>
        ))}
        {config.entries.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            추가된 D-Day가 없습니다.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden />
        D-Day 추가
      </button>
    </div>
  );
}

export default EntryManager;
