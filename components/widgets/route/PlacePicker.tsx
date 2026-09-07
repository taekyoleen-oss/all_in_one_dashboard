"use client";

/**
 * PlacePicker — 위젯 안에서 바로 출발·도착을 고르는 컴팩트 패널.
 *
 *  설정 다이얼로그(⋮ 편집)의 `LocationPicker`는 검색·현재위치·지역·직접입력을 모두
 *  펼치는 큰 폼이라 타일 위에 띄우기엔 무겁다. 여기서는 **길찾기에 실제로 필요한
 *  것만** 남긴다:
 *
 *    ① (출발지) 현재 위치 사용
 *    ② 즐겨찾기 — 자주 가는 곳을 맨 위에 고정
 *    ③ 최근 검색 — 같은 곳을 다시 치지 않도록
 *    ④ 새 검색 — 위 어디에도 없을 때
 *
 *  검색 중에는 결과가 ②③ 자리를 대신한다(좁은 타일에 다 늘어놓으면 아무것도 안 보인다).
 *  즐겨찾기는 별도 저장소가 아니라 목록의 플래그다 — `lib/widgets/route/places.ts`.
 */

import * as React from "react";
import { Clock, LocateFixed, Search, Star, Trash2, X } from "lucide-react";
import {
  favoritePlaces,
  forgetPlace,
  loadPlaces,
  recentPlaces,
  rememberPlace,
  toggleFavoritePlace,
  type SavedPlace,
} from "@/lib/widgets/route/places";
import type { RoutePlace } from "./types";

/** /api/geocode 한 건(서버 모듈을 번들하지 않도록 로컬 타입). */
interface GeoHit {
  label: string;
  detail: string;
  lat: number;
  lon: number;
}

/** 저장된 장소 한 줄 — 고르기 + 즐겨찾기 토글 + 삭제. */
function PlaceRow({
  place,
  onPick,
  onToggleFav,
  onForget,
}: {
  place: SavedPlace;
  onPick: () => void;
  onToggleFav: () => void;
  onForget: () => void;
}) {
  return (
    <li className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onPick}
        className="min-w-0 flex-1 truncate rounded-md border border-border px-2 py-1.5 text-left text-xs text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {place.label}
      </button>
      <button
        type="button"
        onClick={onToggleFav}
        aria-label={
          place.fav
            ? `${place.label} 즐겨찾기 해제`
            : `${place.label} 즐겨찾기에 추가`
        }
        className={`inline-flex w-7 shrink-0 items-center justify-center rounded-md border border-border outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:w-9 ${
          place.fav ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Star size={12} aria-hidden fill={place.fav ? "currentColor" : "none"} />
      </button>
      <button
        type="button"
        onClick={onForget}
        aria-label={`${place.label} 목록에서 삭제`}
        className="inline-flex w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:w-9"
      >
        <Trash2 size={12} aria-hidden />
      </button>
    </li>
  );
}

function SectionLabel({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      {icon}
      {text}
    </span>
  );
}

export function PlacePicker({
  title,
  allowCurrent,
  onPick,
  onUseCurrent,
  onClose,
}: {
  /** '출발지' / '도착지'. */
  title: string;
  /** 출발지일 때만 '현재 위치' 선택지를 준다. */
  allowCurrent: boolean;
  onPick: (place: RoutePlace) => void;
  onUseCurrent: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<GeoHit[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  // 저장된 장소는 마운트 시 한 번 읽고, 고르거나 바꿀 때만 갱신한다.
  const [places, setPlaces] = React.useState<SavedPlace[]>(loadPlaces);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setNote("두 글자 이상 입력하세요.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { results?: GeoHit[] };
      const list = Array.isArray(json.results) ? json.results : [];
      setHits(list);
      if (list.length === 0) setNote("검색 결과가 없습니다.");
    } catch {
      setNote("검색에 실패했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (place: { label: string; lat: number; lon: number }) => {
    setPlaces(rememberPlace(place));
    onPick({ label: place.label, lat: place.lat, lon: place.lon });
  };

  const favs = favoritePlaces(places);
  const recents = recentPlaces(places);
  // 검색 결과가 있으면 그것만 보여준다 — 좁은 타일에 세 목록을 겹쳐 놓지 않는다.
  const showSaved = hits.length === 0;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col gap-2 overflow-y-auto rounded-md border border-border bg-card p-2 pb-scroll"
      data-pb-no-drag
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium text-foreground">{title} 선택</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-8"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {allowCurrent ? (
        <button
          type="button"
          onClick={() => {
            onUseCurrent();
            onClose();
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LocateFixed size={13} aria-hidden className="text-primary" />
          현재 위치에서 출발
        </button>
      ) : null}

      <div className="flex shrink-0 gap-1.5">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setNote(null);
            // 검색어를 지우면 저장된 목록으로 되돌아간다.
            if (e.target.value.trim() === "") setHits([]);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
            if (e.key === "Escape") onClose();
          }}
          placeholder="장소·주소 검색"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 pointer-coarse:px-3 pointer-coarse:py-2"
        >
          <Search size={13} aria-hidden />
          {busy ? "검색 중" : "검색"}
        </button>
      </div>

      {note ? <p className="shrink-0 text-xs text-destructive">{note}</p> : null}

      {showSaved && favs.length > 0 ? (
        <div className="flex flex-col gap-1">
          <SectionLabel
            icon={<Star size={11} aria-hidden fill="currentColor" />}
            text="즐겨찾기"
          />
          <ul className="flex flex-col gap-1">
            {favs.map((f) => (
              <PlaceRow
                key={`${f.lat},${f.lon}`}
                place={f}
                onPick={() => choose(f)}
                onToggleFav={() => setPlaces(toggleFavoritePlace(f))}
                onForget={() => setPlaces(forgetPlace(f))}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {showSaved && recents.length > 0 ? (
        <div className="flex flex-col gap-1">
          <SectionLabel icon={<Clock size={11} aria-hidden />} text="최근 검색" />
          <ul className="flex flex-col gap-1">
            {recents.map((r) => (
              <PlaceRow
                key={`${r.lat},${r.lon}`}
                place={r}
                onPick={() => choose(r)}
                onToggleFav={() => setPlaces(toggleFavoritePlace(r))}
                onForget={() => setPlaces(forgetPlace(r))}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {showSaved && places.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          장소를 검색해 고르면 여기에 최근 목록이 쌓입니다. ★를 누르면 즐겨찾기로
          맨 위에 고정됩니다.
        </p>
      ) : null}

      {hits.length > 0 ? (
        <ul className="flex min-h-0 flex-col gap-1">
          {hits.map((h, i) => (
            <li key={`${h.lat},${h.lon},${i}`}>
              <button
                type="button"
                onClick={() => choose(h)}
                className="flex w-full flex-col items-start gap-0.5 rounded-md border border-border px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="w-full truncate text-xs font-medium text-foreground">
                  {h.label}
                </span>
                {h.detail ? (
                  <span className="w-full truncate text-[10px] text-muted-foreground">
                    {h.detail}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default PlacePicker;
