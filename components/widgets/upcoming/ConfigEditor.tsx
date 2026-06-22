"use client";

/**
 * upcoming · ConfigEditor — 다가오는 일정 추가/수정/삭제/순서변경 (심플 입력).
 *
 *  입력은 최대한 가볍게: 제목 + 날짜만 필수, 시간·장소·이모지는 선택. 이모지는 자주
 *  쓰는 것 빠른선택 + 직접 입력. 변경은 onChange로 전체 config를 보고(부모가 영속).
 */

import * as React from "react";
import { format } from "date-fns";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { suggestTimeFromTitle } from "./compute";
import { QUICK_EMOJIS, type ScheduleEvent, type UpcomingConfig } from "./types";

function newEventId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `evt-${crypto.randomUUID().slice(0, 8)}`
    : `evt-${Math.random().toString(36).slice(2, 10)}`;
}

const inputClass =
  "min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function UpcomingConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<UpcomingConfig>) {
  const setEvents = (events: ScheduleEvent[]) => onChange({ ...config, events });

  const patch = (id: string, fields: Partial<ScheduleEvent>) =>
    setEvents(config.events.map((e) => (e.id === id ? { ...e, ...fields } : e)));

  // 제목 변경 시: 종일이 아니고 시간이 비어 있으면 키워드(점심/아침/저녁)로 시간 자동 채움.
  // 사용자가 이미 시간을 넣었으면 덮어쓰지 않는다.
  const patchTitle = (e: ScheduleEvent, title: string) => {
    const fields: Partial<ScheduleEvent> = { title };
    if (!e.allDay && !e.time) {
      const suggested = suggestTimeFromTitle(title);
      if (suggested) fields.time = suggested;
    }
    patch(e.id, fields);
  };

  const remove = (id: string) =>
    setEvents(config.events.filter((e) => e.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...config.events];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEvents(next);
  };

  const add = () => {
    setEvents([
      ...config.events,
      {
        id: newEventId(),
        title: "",
        date: format(new Date(), "yyyy-MM-dd"),
        time: "",
        place: "",
        emoji: "",
      },
    ]);
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {config.events.map((e, i) => (
          <li
            key={e.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-background/40 p-2"
          >
            {/* 1줄: 이모지 + 제목 + 순서/삭제 */}
            <div className="flex items-center gap-2">
              <input
                value={e.emoji ?? ""}
                onChange={(ev) => patch(e.id, { emoji: ev.target.value.slice(0, 2) })}
                placeholder="🙂"
                aria-label="이모지"
                className={`${inputClass} w-10 text-center`}
              />
              <input
                value={e.title}
                onChange={(ev) => patchTitle(e, ev.target.value)}
                placeholder="제목 (예: 점심 약속)"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                aria-label={`${e.title || "일정"} 위로`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`${e.title || "일정"} 아래로`}
                disabled={i === config.events.length - 1}
                onClick={() => move(i, 1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                aria-label={`${e.title || "일정"} 삭제`}
                onClick={() => remove(e.id)}
                className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* 2줄: 날짜 + 종일 + 시간(선택) + 장소(선택) */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={e.date}
                onChange={(ev) => patch(e.id, { date: ev.target.value })}
                aria-label="날짜"
                className={inputClass}
              />
              <label className="flex items-center gap-1.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={!!e.allDay}
                  onChange={(ev) =>
                    patch(e.id, {
                      allDay: ev.target.checked,
                      // 종일을 켜면 시간은 비운다.
                      ...(ev.target.checked ? { time: "" } : {}),
                    })
                  }
                  className="size-4 accent-[var(--primary)]"
                />
                종일
              </label>
              <input
                type="time"
                value={e.time ?? ""}
                disabled={!!e.allDay}
                onChange={(ev) => patch(e.id, { time: ev.target.value })}
                aria-label="시간 (선택)"
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-40`}
              />
              <input
                value={e.place ?? ""}
                onChange={(ev) => patch(e.id, { place: ev.target.value })}
                placeholder="장소 (선택)"
                aria-label="장소 (선택)"
                className={`${inputClass} flex-1`}
              />
            </div>

            {/* 이모지 빠른 선택 */}
            <div className="flex flex-wrap gap-1">
              {QUICK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  aria-label={`이모지 ${em}`}
                  onClick={() => patch(e.id, { emoji: em })}
                  className={[
                    "inline-flex size-7 items-center justify-center rounded-md border text-base outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    e.emoji === em ? "border-primary bg-accent" : "border-border",
                  ].join(" ")}
                >
                  {em}
                </button>
              ))}
            </div>
          </li>
        ))}
        {config.events.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            추가된 일정이 없습니다.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden />
        일정 추가
      </button>
    </div>
  );
}

export default UpcomingConfigEditor;
