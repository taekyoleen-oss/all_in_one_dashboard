/**
 * ============================================================================
 *  길찾기 — 장소 목록: 최근 검색 + 즐겨찾기 (기기 로컬)
 * ============================================================================
 *
 *  같은 곳을 매번 다시 검색하지 않도록 고른 장소를 기억한다. 위젯 인스턴스별이
 *  아니라 **기기 단위**로 공유한다 — 한 위젯에서 찾은 집·회사를 다른 위젯에서도
 *  바로 쓰는 게 자연스럽다.
 *
 *  ── 즐겨찾기는 별도 저장소가 아니라 이 목록의 플래그다 ────────────────────
 *  `fav`를 켜면 목록 맨 위로 고정되고 **상한 정리에서 제외**된다(자주 쓰는 곳이
 *  검색을 몇 번 더 했다고 밀려나면 안 된다). 클립보드 위젯의 즐겨찾기와 같은
 *  구조 — 목록을 둘로 쪼개면 "최근에 쓴 즐겨찾기"가 양쪽에 중복된다.
 *
 *  저장은 localStorage(`pb:routeRecent`). 장소 이름은 개인 동선을 드러내므로
 *  서버(config)에 쌓지 않는다.
 *
 *  순수 로직(addPlace·toggleFavorite·sameSpot)과 저장소 접근(load/save)을 나눠
 *  두어 앞쪽만 테스트한다.
 */

/** 목록 한 칸. */
export interface SavedPlace {
  label: string;
  lat: number;
  lon: number;
  /** 마지막으로 고른 시각(epoch ms) — 최근 정렬 기준. */
  at: number;
  /** 즐겨찾기면 맨 위 고정 + 상한 정리 제외. */
  fav?: boolean;
}

/** 즐겨찾기가 아닌 항목을 유지할 최대 개수. */
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

/** 즐겨찾기 먼저, 그 안에서 최신순. */
function ordered(list: readonly SavedPlace[]): SavedPlace[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.fav) !== Boolean(b.fav)) return a.fav ? -1 : 1;
    return b.at - a.at;
  });
}

/** 즐겨찾기는 남기고 최근 항목만 상한까지 자른다. */
function trim(list: readonly SavedPlace[], cap: number): SavedPlace[] {
  const favs = list.filter((p) => p.fav);
  const rest = list.filter((p) => !p.fav).slice(0, Math.max(0, cap));
  return ordered([...favs, ...rest]);
}

/**
 * 장소를 목록에 넣는다(같은 지점은 합치고, 상한을 넘으면 오래된 최근 항목부터 버린다).
 * 이미 즐겨찾기인 곳을 다시 고르면 즐겨찾기 상태가 유지된다.
 * 원본을 바꾸지 않고 새 배열을 돌려준다.
 */
export function addPlace(
  list: readonly SavedPlace[],
  place: { label: string; lat: number; lon: number },
  now: number,
  cap: number = RECENT_CAP,
): SavedPlace[] {
  const label = place.label?.trim();
  // 이름 없는 좌표는 목록에서 알아볼 수 없으므로 담지 않는다.
  if (!label || !Number.isFinite(place.lat) || !Number.isFinite(place.lon)) {
    return ordered(list);
  }
  const existing = list.find((p) => sameSpot(p, place));
  const entry: SavedPlace = {
    label,
    lat: place.lat,
    lon: place.lon,
    at: now,
    // 즐겨찾기였다면 유지한다 — 다시 검색했다고 해제되면 곤란하다.
    ...(existing?.fav ? { fav: true } : {}),
  };
  const rest = list.filter((p) => !sameSpot(p, entry));
  return trim([entry, ...rest], cap);
}

/** 즐겨찾기를 켜고 끈다. 목록에 없으면 그대로. */
export function toggleFavorite(
  list: readonly SavedPlace[],
  place: { lat: number; lon: number },
): SavedPlace[] {
  return ordered(
    list.map((p) => (sameSpot(p, place) ? { ...p, fav: !p.fav } : p)),
  );
}

/** 목록에서 한 곳을 지운다(즐겨찾기든 아니든). */
export function removePlace(
  list: readonly SavedPlace[],
  place: { lat: number; lon: number },
): SavedPlace[] {
  return list.filter((p) => !sameSpot(p, place));
}

/** 즐겨찾기만. */
export const favoritePlaces = (list: readonly SavedPlace[]): SavedPlace[] =>
  ordered(list).filter((p) => p.fav);

/** 즐겨찾기가 아닌 최근 항목만. */
export const recentPlaces = (list: readonly SavedPlace[]): SavedPlace[] =>
  ordered(list).filter((p) => !p.fav);

/* ------------------------------- 저장소 ---------------------------------- */

/** 저장된 목록. 없거나 깨졌으면 빈 배열(예외를 던지지 않는다). */
export function loadPlaces(): SavedPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return ordered(
      parsed.filter(
        (p): p is SavedPlace =>
          typeof p === "object" &&
          p !== null &&
          typeof (p as SavedPlace).label === "string" &&
          Number.isFinite((p as SavedPlace).lat) &&
          Number.isFinite((p as SavedPlace).lon),
      ),
    );
  } catch {
    return [];
  }
}

/** 목록을 저장한다. 용량 초과 등 실패는 조용히 넘긴다(부가 기능이다). */
export function savePlaces(list: readonly SavedPlace[]): void {
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
}): SavedPlace[] {
  const next = addPlace(loadPlaces(), place, Date.now());
  savePlaces(next);
  return next;
}

/** 즐겨찾기를 켜고 끈 뒤 갱신된 목록을 돌려준다. */
export function toggleFavoritePlace(place: {
  lat: number;
  lon: number;
}): SavedPlace[] {
  const next = toggleFavorite(loadPlaces(), place);
  savePlaces(next);
  return next;
}

/** 목록에서 한 곳을 지우고 갱신된 목록을 돌려준다. */
export function forgetPlace(place: { lat: number; lon: number }): SavedPlace[] {
  const next = removePlace(loadPlaces(), place);
  savePlaces(next);
  return next;
}
