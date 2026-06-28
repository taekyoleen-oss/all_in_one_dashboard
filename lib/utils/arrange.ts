/**
 * arrangeLayout — 자동정렬(정리하기).
 *
 * 기본(크기 유지): 위젯의 폭·높이를 그대로 둔 채, 현재 화면 배열(읽기 순서
 * 위→아래·왼→오)을 유지하며 위/빈 공간을 메운다. 각 위젯을 위→아래·왼→오로
 * 스캔한 첫 빈 칸(firstFreeSlot)에 흘려 담아 상단 공백·세로/가로 공백을 모두
 * 끌어올린다(masonry). 크기는 절대 바꾸지 않는다.
 *
 * 선택 기능(크기 변경 — 토글로만 켬):
 *   • justify(가로 채우기): 행 기반으로 묶어 행의 남은 칸을 위젯들에 라운드로빈으로
 *     더해 각 위젯의 maxW 한도까지 넓힌다.
 *   • equalizeHeights(행 높이 맞춤): 한 행 위젯들의 높이를 그 행 최대치로 통일한다.
 *
 * justify·equalizeHeights가 모두 꺼져 있으면 masonry(크기 유지)로 동작한다.
 * 만든 순서가 아니라 "현재 위치" 기준이라, 보이는 배열 그대로 정돈된다.
 */

import type { CanvasLayoutItem } from "@/components/canvas/GridCanvas";

export interface ArrangeOptions {
  /** Grid column count (lg = 24). */
  cols: number;
  /** Max width (grid cols) a given instance may occupy (registry maxSize.w, capped to cols). */
  maxWOf: (instanceId: string) => number;
  /** Widen items to fill each row's leftover columns (가로 빈공간 채우기). 기본 OFF. */
  justify: boolean;
  /** Equalize every item's height within a row to that row's tallest (행 높이 맞춤). 기본 OFF. */
  equalizeHeights: boolean;
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.round(v);
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/** Do two grid rects overlap? (shared edges don't count). */
function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/**
 * 크기 유지 masonry: 현재 위치(y→x) 순서대로 각 위젯을 위→아래·왼→오 첫 빈 칸에
 * 그 크기 그대로 담는다. 상단/세로/가로 공백을 모두 끌어올려 메우되 폭·높이는 불변.
 */
function masonryPack(
  layout: CanvasLayoutItem[],
  cols: number,
): CanvasLayoutItem[] {
  const ordered = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: CanvasLayoutItem[] = [];
  for (const it of ordered) {
    const w = clampInt(it.w, 1, cols);
    const h = Math.max(1, Math.round(it.h));
    let slot: { x: number; y: number } | null = null;
    for (let y = 0; slot === null; y += 1) {
      for (let x = 0; x <= cols - w; x += 1) {
        const rect = { x, y, w, h };
        if (!placed.some((p) => rectsOverlap(rect, p))) {
          slot = { x, y };
          break;
        }
      }
    }
    placed.push({ instanceId: it.instanceId, x: slot.x, y: slot.y, w, h });
  }
  return placed;
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

  // 기본(둘 다 OFF): 크기 유지 masonry — 상단/빈 공간만 메우고 폭·높이는 불변.
  if (!justify && !equalizeHeights) return masonryPack(layout, cols);

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
