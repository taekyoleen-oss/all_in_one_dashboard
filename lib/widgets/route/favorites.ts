/**
 * ============================================================================
 *  길찾기 — 즐겨찾기 경로 (기기 로컬)
 * ============================================================================
 *
 *  자주 걷는 길(집→회사, 역→사무실)을 저장해 두고 한 번에 불러온다. 저장 단위는
 *  **한 지점이 아니라 출발·도착 쌍**이다 — 길찾기에서 되풀이되는 것은 장소 하나가
 *  아니라 경로이기 때문이다.
 *
 *  출발지가 '현재 위치'(null)인 것도 그대로 저장한다. "지금 어디에 있든 집으로"가
 *  가장 쓸모 있는 즐겨찾기라, 좌표로 굳혀 버리면 오히려 쓸모가 없어진다.
 *
 *  저장은 localStorage(`pb:routeFavorites`). 장소 이름은 개인 동선을 드러내므로
 *  서버(config)에 쌓지 않는다 — 최근 검색(`recent.ts`)과 같은 판단.
 */

/** 저장된 지점. null이면 '현재 위치'. */
export interface FavoritePlace {
  label: string;
  lat: number;
  lon: number;
}

/** 즐겨찾기 경로 한 칸. */
export interface FavoriteRoute {
  /** 출발·도착으로 만든 안정적인 키(같은 경로를 두 번 저장하지 않기 위함). */
  id: string;
  /** 출발지. null이면 '현재 위치'에서 출발. */
  start: FavoritePlace | null;
  end: FavoritePlace;
  /** 계단 회피 여부까지 함께 복원한다. */
  avoidStairs: boolean;
  /** 저장 시각(epoch ms) — 최신순 정렬. */
  at: number;
}

/** 유지할 최대 개수. */
export const FAVORITES_CAP = 12;

const STORAGE_KEY = "pb:routeFavorites";

/** 좌표를 ≈11m 격자로 줄여 키를 만든다(같은 곳의 미세한 좌표 차이를 흡수). */
const spot = (p: FavoritePlace | null): string =>
  p ? `${p.lat.toFixed(4)},${p.lon.toFixed(4)}` : "here";

/**
 * 출발·도착·옵션으로 만드는 안정적인 식별자.
 * 같은 경로를 다시 저장해도 중복이 생기지 않는다.
 */
export function favoriteId(
  start: FavoritePlace | null,
  end: FavoritePlace,
  avoidStairs: boolean,
): string {
  return `${spot(start)}>${spot(end)}${avoidStairs ? "|s" : ""}`;
}

/** 목록에 보여줄 이름 — "현재 위치 → 회사". */
export function favoriteLabel(fav: FavoriteRoute): string {
  return `${fav.start?.label || "현재 위치"} → ${fav.end.label}`;
}

/**
 * 경로를 즐겨찾기에 넣는다(이미 있으면 맨 앞으로 올리고 시각만 갱신).
 * 원본을 바꾸지 않고 새 배열을 돌려준다.
 */
export function addFavorite(
  list: readonly FavoriteRoute[],
  start: FavoritePlace | null,
  end: FavoritePlace,
  avoidStairs: boolean,
  now: number,
  cap: number = FAVORITES_CAP,
): FavoriteRoute[] {
  // 도착지가 없거나 이름이 없으면 목록에서 알아볼 수 없다.
  if (!end?.label?.trim() || !Number.isFinite(end.lat) || !Number.isFinite(end.lon)) {
    return [...list];
  }
  const id = favoriteId(start, end, avoidStairs);
  const entry: FavoriteRoute = { id, start, end, avoidStairs, at: now };
  const rest = list.filter((f) => f.id !== id);
  return [entry, ...rest].slice(0, Math.max(0, cap));
}

/** 즐겨찾기에서 뺀다. */
export function removeFavorite(
  list: readonly FavoriteRoute[],
  id: string,
): FavoriteRoute[] {
  return list.filter((f) => f.id !== id);
}

/** 이 경로가 이미 즐겨찾기에 있는가. */
export function isFavorite(
  list: readonly FavoriteRoute[],
  start: FavoritePlace | null,
  end: FavoritePlace | null,
  avoidStairs: boolean,
): boolean {
  if (!end) return false;
  const id = favoriteId(start, end, avoidStairs);
  return list.some((f) => f.id === id);
}

/* ------------------------------- 저장소 ---------------------------------- */

function valid(f: unknown): f is FavoriteRoute {
  if (typeof f !== "object" || f === null) return false;
  const x = f as FavoriteRoute;
  return (
    typeof x.id === "string" &&
    typeof x.end === "object" &&
    x.end !== null &&
    typeof x.end.label === "string" &&
    Number.isFinite(x.end.lat) &&
    Number.isFinite(x.end.lon)
  );
}

/** 저장된 즐겨찾기. 없거나 깨졌으면 빈 배열(예외를 던지지 않는다). */
export function loadFavorites(): FavoriteRoute[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(valid) : [];
  } catch {
    return [];
  }
}

/** 즐겨찾기를 저장한다. 실패는 조용히 넘긴다(부가 기능이다). */
export function saveFavorites(list: readonly FavoriteRoute[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 저장 못 해도 길찾기 자체는 동작해야 한다 */
  }
}

/** 현재 경로를 즐겨찾기에 넣고 갱신된 목록을 돌려준다. */
export function starRoute(
  start: FavoritePlace | null,
  end: FavoritePlace,
  avoidStairs: boolean,
): FavoriteRoute[] {
  const next = addFavorite(loadFavorites(), start, end, avoidStairs, Date.now());
  saveFavorites(next);
  return next;
}

/** 즐겨찾기에서 빼고 갱신된 목록을 돌려준다. */
export function unstarRoute(id: string): FavoriteRoute[] {
  const next = removeFavorite(loadFavorites(), id);
  saveFavorites(next);
  return next;
}
