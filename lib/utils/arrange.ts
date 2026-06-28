/**
 * arrangeLayout — 자동정렬(정리하기)의 행(row) 기반 배치기.
 *
 * 현재 화면 배열(읽기 순서: 위→아래, 왼→오)을 유지한 채:
 *   1) 빈 공간 제거 — 위젯을 한 행에 폭이 차도록 좌→우로 담고, 넘치면 다음 행으로.
 *   2) 가로 빈공간 채우기(justify) — 행의 남은 칸을 위젯들에 라운드로빈으로 더해
 *      각 위젯의 maxW 한도까지 넓혀 가로를 가득 채운다.
 *   3) 행 높이 맞춤(equalizeHeights, 선택) — 한 행 위젯들의 높이를 그 행에서 가장
 *      큰 높이로 통일해 들쭉날쭉을 없앤다.
 *
 * 폭/높이는 보존이 기본이며, justify/equalizeHeights가 켜진 경우에만 조정한다.
 * 만든 순서가 아니라 "현재 위치" 기준이라, 보이는 배열 그대로 정돈된다.
 */

import type { CanvasLayoutItem } from "@/components/canvas/GridCanvas";

export interface ArrangeOptions {
  /** Grid column count (lg = 24). */
  cols: number;
  /** Max width (grid cols) a given instance may occupy (registry maxSize.w, capped to cols). */
  maxWOf: (instanceId: string) => number;
  /** Widen items to fill each row's leftover columns (가로 빈공간 채우기). */
  justify: boolean;
  /** Equalize every item's height within a row to that row's tallest (행 높이 맞춤). */
  equalizeHeights: boolean;
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.round(v);
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/** Distribute a row's leftover columns across its items, respecting each maxW. */
function justifyRow(
  items: CanvasLayoutItem[],
  widths: number[],
  cols: number,
  maxWOf: (id: string) => number,
): number[] {
  const out = [...widths];
  const caps = items.map((it) => Math.min(maxWOf(it.instanceId), cols));
  let leftover = cols - out.reduce((a, b) => a + b, 0);
  // Round-robin: +1 col to each item that still has headroom, until full or capped.
  let guard = 0;
  while (leftover > 0 && guard < 100_000) {
    let grew = false;
    for (let i = 0; i < out.length && leftover > 0; i += 1) {
      if (out[i] < caps[i]) {
        out[i] += 1;
        leftover -= 1;
        grew = true;
      }
    }
    guard += 1;
    if (!grew) break; // every item at its cap → leave the rest empty
  }
  return out;
}

export function arrangeLayout(
  layout: CanvasLayoutItem[],
  opts: ArrangeOptions,
): CanvasLayoutItem[] {
  const { cols, maxWOf, justify, equalizeHeights } = opts;
  if (layout.length === 0) return [];

  // 현재 위치(y→x) = 화면 읽기 순서. 만든 순서(배열 순서)가 아니다.
  const ordered = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);

  // 1) 행으로 묶기: 폭 합이 cols를 넘으면 새 행.
  const rows: CanvasLayoutItem[][] = [];
  let row: CanvasLayoutItem[] = [];
  let used = 0;
  for (const it of ordered) {
    const w = clampInt(it.w, 1, cols);
    const h = Math.max(1, Math.round(it.h));
    const item: CanvasLayoutItem = { ...it, w, h };
    if (row.length > 0 && used + w > cols) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(item);
    used += w;
  }
  if (row.length > 0) rows.push(row);

  // 2) 행을 위에서 아래로 배치(+ justify / equalize).
  const out: CanvasLayoutItem[] = [];
  let y = 0;
  for (const r of rows) {
    const baseWidths = r.map((it) => it.w);
    const widths = justify ? justifyRow(r, baseWidths, cols, maxWOf) : baseWidths;
    const rowMaxH = Math.max(...r.map((it) => it.h));
    let x = 0;
    r.forEach((it, i) => {
      const w = widths[i];
      const h = equalizeHeights ? rowMaxH : it.h;
      out.push({ instanceId: it.instanceId, x, y, w, h });
      x += w;
    });
    // 다음 행 y: 이 행에서 가장 큰 높이만큼 내려간다(equalize면 모두 rowMaxH).
    y += rowMaxH;
  }
  return out;
}
