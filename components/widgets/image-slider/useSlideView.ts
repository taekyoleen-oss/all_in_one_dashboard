"use client";

/**
 * image-slider · slideView — 마지막 본 화면(슬라이드 번호 + 패닝 위치) 영속.
 *
 *  타일에서 마지막으로 보던 슬라이드와 스크롤(패닝) 위치를 인스턴스별 localStorage에
 *  저장해, 새로고침·재방문 후에도 같은 화면으로 복원한다(2026-07-12 사용자 요청).
 *  뷰 상태는 기기·타일 크기에 종속이라 config(jsonb) 동기화 대신 기기 로컬에 둔다
 *  (outfit의 usePersistedPeriod와 같은 계열 — 여기는 마운트 1회 읽기 + 쓰기만이라
 *  구독 스토어 없이 순수 read/write 헬퍼로 충분).
 */

export interface SlideView {
  /** 마지막 본 슬라이드 index — 호출부가 images.length로 범위 검증 후 사용. */
  index: number;
  /** 뷰포트 스크롤 오프셋(px). */
  top: number;
  left: number;
}

const keyOf = (id: string) => `pb:imageSliderView:${id}`;

const FALLBACK: SlideView = { index: 0, top: 0, left: 0 };

const nonNegative = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0;

export function readSlideView(instanceId: string): SlideView {
  if (typeof window === "undefined") return FALLBACK;
  try {
    const raw = window.localStorage.getItem(keyOf(instanceId));
    if (!raw) return FALLBACK;
    const p = JSON.parse(raw) as Partial<SlideView>;
    return {
      index: Math.floor(nonNegative(p.index)),
      top: nonNegative(p.top),
      left: nonNegative(p.left),
    };
  } catch {
    return FALLBACK;
  }
}

export function writeSlideView(instanceId: string, view: SlideView): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyOf(instanceId), JSON.stringify(view));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}
