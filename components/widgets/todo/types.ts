/**
 * todo widget — config shape (설계서 §2.2: 인스턴스별 체크리스트, Supabase config).
 *
 *  Items live in `config` (JSON-serializable) so every view renders purely from
 *  config and editing re-renders the tile. dataMode: 'static'.
 *
 *  // TODO(persist): this widget may later optionally move its items to a
 *  // `pb_todos`-style table; for now they stay in `pb_widgets.config`.
 */
export interface TodoItem {
  /** Stable id (list keys + reorder). */
  id: string;
  /** Item text, e.g. "장보기". */
  text: string;
  /** Done flag (struck through + counted toward progress). */
  done: boolean;
}

export interface TodoConfig {
  /** List heading shown above the checklist. */
  title: string;
  /** The checklist items, in display order. */
  items: TodoItem[];
}

export const DEFAULT_TODO_CONFIG: TodoConfig = {
  title: "할 일",
  items: [
    { id: "t1", text: "첫 번째 할 일", done: false },
    { id: "t2", text: "두 번째 할 일", done: true },
  ],
};

/** Completed / total / 0–100 percentage for a set of items. */
export interface TodoProgress {
  done: number;
  total: number;
  percent: number;
}

export function computeProgress(items: TodoItem[]): TodoProgress {
  const total = items.length;
  const done = items.reduce((n, it) => n + (it.done ? 1 : 0), 0);
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}
