"use client";

/**
 * todo · ItemManager — add / edit / remove / reorder + toggle done (설계서 §2.2).
 *
 *  Controlled: reports the whole next config via onChange (the parent owns the
 *  draft + persistence). All checklist mutation lives here because the frozen
 *  contract gives no onChange to Compact/Expanded. Reorder via up/down buttons
 *  (keyboard-operable); the checkbox here is the editable one (unlike the views).
 */

import * as React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { TodoConfig, TodoItem } from "./types";

function newItemId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `todo-${crypto.randomUUID().slice(0, 6)}`
    : `todo-${Math.random().toString(36).slice(2, 8)}`;
}

export function ItemManager({
  config,
  onChange,
}: {
  config: TodoConfig;
  onChange: (next: TodoConfig) => void;
}) {
  const setItems = (items: TodoItem[]) => onChange({ ...config, items });

  const patch = (id: string, fields: Partial<TodoItem>) =>
    setItems(config.items.map((it) => (it.id === id ? { ...it, ...fields } : it)));

  const remove = (id: string) =>
    setItems(config.items.filter((it) => it.id !== id));

  const move = (index: number, dir: -1 | 1) => {
    const next = [...config.items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  };

  const add = () => {
    setItems([...config.items, { id: newItemId(), text: "", done: false }]);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="text-muted-foreground">목록 제목</span>
        <input
          value={config.title}
          onChange={(e) => onChange({ ...config, title: e.target.value })}
          placeholder="할 일"
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <ul className="flex flex-col gap-2">
        {config.items.map((it, i) => (
          <li
            key={it.id}
            className="flex items-center gap-2 rounded-md border border-border bg-background/40 p-2"
          >
            <input
              type="checkbox"
              checked={it.done}
              onChange={(e) => patch(it.id, { done: e.target.checked })}
              aria-label={`${it.text || "항목"} 완료`}
              className="size-4 shrink-0 accent-[var(--primary)]"
            />
            <input
              value={it.text}
              onChange={(e) => patch(it.id, { text: e.target.value })}
              placeholder="할 일 내용"
              className={[
                "min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                it.done ? "text-muted-foreground line-through" : "text-foreground",
              ].join(" ")}
            />
            <button
              type="button"
              aria-label={`${it.text || "항목"} 위로`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              aria-label={`${it.text || "항목"} 아래로`}
              disabled={i === config.items.length - 1}
              onClick={() => move(i, 1)}
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowDown size={15} />
            </button>
            <button
              type="button"
              aria-label={`${it.text || "항목"} 삭제`}
              onClick={() => remove(it.id)}
              className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {config.items.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
            추가된 할 일이 없습니다.
          </li>
        ) : null}
      </ul>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus size={15} aria-hidden />
        할 일 추가
      </button>
    </div>
  );
}

export default ItemManager;
