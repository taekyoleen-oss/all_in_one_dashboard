"use client";

/**
 * useDragAutoScroll — page edge auto-scroll while dragging a canvas tile.
 *
 * 요구: 위젯을 위로 끌어 상단 메뉴(sticky 헤더)까지 가면 캔버스 내용이 아래로
 * 내려가(=페이지가 위로 스크롤) 위젯을 더 위쪽 칸으로 옮길 수 있어야 한다.
 *
 * 왜 필요한가: react-grid-layout 은 react-draggable 위에서 동작하고, 타일의
 * 그리드 위치는 오직 mousemove/touchmove 이벤트가 올 때만 재계산된다. 커서가
 * 화면 가장자리에 멈춘 채 페이지만 스크롤되면 이동 이벤트가 발생하지 않아 타일이
 * 따라오지 않는다. 그래서 rAF 루프로 (1) 화면을 조금씩 스크롤하고, (2) 직전 커서
 * 좌표로 합성 mousemove 를 디스패치해 react-draggable 이 (스크롤된) 그리드의
 * 실시간 위치를 다시 읽어 타일을 위/아래 칸으로 따라오게 한다.
 *
 * react-draggable 의 위치 계산은 offsetParent.getBoundingClientRect() (라이브)
 * 를 쓰므로, 같은 clientY 라도 페이지가 위로 스크롤되면 그리드 top 이 내려가
 * (rect.top↑) 계산된 그리드 행이 위로 올라간다 → 타일이 더 위 칸으로 이동.
 */

import * as React from "react";

export interface DragAutoScrollOptions {
  /**
   * 상단 트리거 영역(px). sticky 헤더를 덮도록 충분히 크게. `topAnchorSelector`
   * 로 헤더를 찾으면 그 바닥 + 28px 와 이 값 중 큰 값을 쓴다.
   */
  topZone?: number;
  /** 하단 트리거 영역(px). 화면 아래쪽 이 영역에 커서가 닿으면 아래로 스크롤. */
  bottomZone?: number;
  /** 프레임당 최대 스크롤 속도(px). 영역에 깊이 들어갈수록 빨라진다. */
  maxSpeed?: number;
  /** 상단 영역을 헤더 바닥에 맞추기 위한 sticky 헤더 셀렉터. */
  topAnchorSelector?: string;
}

export interface DragAutoScroll {
  /** 드래그 시작 시 호출 — rAF 루프를 켜고 헤더 높이를 측정한다. */
  start: () => void;
  /** 드래그 중(onDrag) 매 틱마다 호출 — 마지막 커서 좌표를 갱신한다. */
  onPointer: (e: Event) => void;
  /** 드래그 종료 시 호출 — 루프를 멈춘다. */
  stop: () => void;
}

export function useDragAutoScroll(
  opts: DragAutoScrollOptions = {},
): DragAutoScroll {
  const {
    topZone = 100,
    bottomZone = 80,
    maxSpeed = 22,
    topAnchorSelector = "[data-pb-sticky-header]",
  } = opts;

  const rafRef = React.useRef<number | null>(null);
  const pointerRef = React.useRef<{ x: number; y: number } | null>(null);
  const activeRef = React.useRef(false);
  // 측정된 상단 트리거 임계값(헤더 바닥 + 버퍼). 드래그 시작 시 한 번 잰다 —
  // sticky top-0 라 스크롤해도 바닥 위치는 일정하다.
  const topThresholdRef = React.useRef(topZone);

  const stop = React.useCallback(() => {
    activeRef.current = false;
    pointerRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = React.useCallback(() => {
    rafRef.current = null;
    if (!activeRef.current) return;
    const p = pointerRef.current;
    if (p && typeof window !== "undefined") {
      const vh = window.innerHeight;
      const topT = topThresholdRef.current;
      let dy = 0;
      if (p.y < topT) {
        const depth = Math.min(1, (topT - p.y) / topT); // 0..1
        dy = -Math.max(3, Math.round(depth * maxSpeed));
      } else if (p.y > vh - bottomZone) {
        const depth = Math.min(1, (p.y - (vh - bottomZone)) / bottomZone);
        dy = Math.max(3, Math.round(depth * maxSpeed));
      }
      if (dy !== 0) {
        const before = window.scrollY;
        window.scrollBy(0, dy);
        // 실제로 스크롤됐을 때만 합성 이동 이벤트로 타일을 따라오게 한다.
        if (window.scrollY !== before) {
          const ev = new MouseEvent("mousemove", {
            clientX: p.x,
            clientY: p.y,
            bubbles: true,
            cancelable: true,
            view: window,
          });
          document.dispatchEvent(ev);
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [bottomZone, maxSpeed]);

  const start = React.useCallback(() => {
    if (typeof document !== "undefined") {
      const header =
        document.querySelector<HTMLElement>(topAnchorSelector) ?? null;
      const bottom = header?.getBoundingClientRect().bottom ?? 0;
      topThresholdRef.current = Math.max(topZone, Math.round(bottom) + 28);
    }
    if (activeRef.current) return;
    activeRef.current = true;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick, topAnchorSelector, topZone]);

  const onPointer = React.useCallback((e: Event) => {
    const me = e as MouseEvent & { touches?: TouchList };
    const x = me.touches?.[0]?.clientX ?? me.clientX;
    const y = me.touches?.[0]?.clientY ?? me.clientY;
    if (typeof x === "number" && typeof y === "number") {
      pointerRef.current = { x, y };
    }
  }, []);

  // 언마운트 시 루프 정리.
  React.useEffect(() => stop, [stop]);

  return { start, onPointer, stop };
}
