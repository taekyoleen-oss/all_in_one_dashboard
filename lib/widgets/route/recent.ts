/**
 * ============================================================================
 *  길찾기 — 최근 검색한 장소 (기기 로컬)
 * ============================================================================
 *
 *  같은 곳을 매번 다시 검색하지 않도록 고른 장소를 기억한다. 위젯 인스턴스별이
 *  아니라 **기기 단위**로 공유한다 — 한 위젯에서 찾은 집·회사를 다른 위젯에서도
 *  바로 쓰는 게 자연스럽다.
 *
 *  저장은 localStorage(`pb:routeRecent`)다. 장소 이름은 개인 동선을 드러내므로
 *  서버(config)에 쌓지 않는다 — 클립보드 위젯이 기기 로컬을 택한 것과 같은 판단.
 *
 *  순수 로직(addRecent·sameSpot)과 저장소 접근(load/save)을 나눠 두어 앞쪽만
 *  테스트한다.
 */

/** 최근 목록 한 칸. */
export interface RecentPlace {
  label: string;
  lat: number;
  lon: number;
  /** 마지막으로 고른 시각(epoch ms) — 정렬 기준. */
  at: number;
}

/** 목록에 유지할 최대 개수. 넘치면 오래된 것부터 버린다. */
export const RECENT_CAP = 8;

const STORAGE_KEY = "pb:routeRecent";

/**
 * 같은 지점인가(≈11m). 좌표가 미세하게 다른 같은 장소가 목록을 채우는 걸 막는다.
 * 라벨이 달라도 좌표가 같으면 같은 곳으로 본다(사용자가 최근에 부른 이름을 남긴다).
 */
export function sameSpot(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): boolean {
  return Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4;
}

/**
 * 장소를 목록 맨 앞에 넣는다(같은 지점은 합치고, 상한을 넘으면 잘라낸다).
 * 원본을 바꾸지 않고 새 배열을 돌려준다.
 */
export function addRecent(
  list: readonly RecentPlace[],
  place: { label: string; lat: number; lon: number },
  now: number,
  cap: number = RECENT_CAP,
): RecentPlace[] {
  const label = place.label?.trim();
  // 이름 없는 좌표는 목록에서 알아볼 수 없으므로 담지 않는다.
  if (!label || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
    return [...list];
  }
  const entry: RecentPlace = { label, lat: place.lat, lon: place.lon, at: now };
  const rest = list.filter((p) => !sameSpot(p, entry));
  return [entry, ...rest].slice(0, Math.max(0, cap));
}

/** 목록에서 한 곳을 지운다. */
export function removeRecent(
  list: readonly RecentPlace[],
  place: { lat: number; lon: number },
): RecentPlace[] {
  return list.filter((p) => !sameSpot(p, place));
}

/* ------------------------------- 저장소 ---------------------------------- */

/** 저장된 최근 목록. 없거나 깨졌으면 빈 배열(예외를 던지지 않는다). */
export function loadRecent(): RecentPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is RecentPlace =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as RecentPlace).label === "string" &&
        Number.isFinite((p as RecentPlace).lat) &&
        Number.isFinite((p as RecentPlace).lon),
    );
  } catch {
    return [];
  }
}

/** 최근 목록을 저장한다. 용량 초과 등 실패는 조용히 넘긴다(부가 기능이다). */
export function saveRecent(list: readonly RecentPlace[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 저장 못 해도 길찾기 자체는 동작해야 한다 */
  }
}

/** 고른 장소를 기억하고 갱신된 목록을 돌려준다. */
export function rememberPlace(place: {
  label: string;
  lat: number;
  lon: number;
}): RecentPlace[] {
  const next = addRecent(loadRecent(), place, Date.now());
  saveRecent(next);
  return next;
}

/** 최근 목록에서 한 곳을 지우고 갱신된 목록을 돌려준다. */
export function forgetPlace(place: { lat: number; lon: number }): RecentPlace[] {
  const next = removeRecent(loadRecent(), place);
  saveRecent(next);
  return next;
}
