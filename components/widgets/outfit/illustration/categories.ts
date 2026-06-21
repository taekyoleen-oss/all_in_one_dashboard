/** 외출옷 추천 — 카테고리 정렬·라벨 (원본 lib/outfit/categories.ts 이식). */
export const CATEGORY_ORDER = [
  "base",
  "top",
  "mid",
  "outer",
  "bottom",
  "foot",
  "acc",
  "rain",
  "mask",
] as const;

export type OutfitCategoryKey = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_LABELS: Record<OutfitCategoryKey, string> = {
  base: "이너",
  top: "상의",
  mid: "미들레이어",
  outer: "아우터",
  bottom: "하의",
  foot: "신발",
  acc: "액세서리",
  rain: "우천 준비",
  mask: "마스크",
};
