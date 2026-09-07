"use client";

/**
 * FavoritesPanel — 자주 걷는 길을 저장하고 한 번에 불러오는 패널.
 *
 *  저장 단위는 **출발·도착 쌍**이라 하나를 고르면 두 지점이 함께 복원된다(계단 회피
 *  옵션까지). 출발지가 '현재 위치'인 즐겨찾기는 좌표로 굳히지 않으므로 어디에서
 *  눌러도 "지금 여기서 집으로"가 된다.
 */

import * as React from "react";
import { Star, Trash2, X } from "lucide-react";
import {
  favoriteId,
  favoriteLabel,
  loadFavorites,
  starRoute,
  unstarRoute,
  type FavoriteRoute,
} from "@/lib/widgets/route/favorites";
import type { RouteConfig } from "./types";

export function FavoritesPanel({
  config,
  saved,
  onLoad,
  onClose,
}: {
  config: RouteConfig;
  /** 지금 보고 있는 경로가 이미 저장돼 있는가. */
  saved: boolean;
  /** 즐겨찾기를 골랐을 때 — 출발·도착·옵션을 한 번에 적용한다. */
  onLoad: (next: RouteConfig) => void;
  onClose: () => void;
}) {
  const [list, setList] = React.useState<FavoriteRoute[]>(loadFavorites);

  const toggleCurrent = () => {
    if (!config.end) return;
    if (saved) {
      setList(unstarRoute(favoriteId(config.start, config.end, config.avoidStairs)));
      return;
    }
    setList(starRoute(config.start, config.end, config.avoidStairs));
  };

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col gap-2 overflow-y-auto rounded-md border border-border bg-card p-2 pb-scroll"
      data-pb-no-drag
    >
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium text-foreground">즐겨찾기 경로</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="ml-auto inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-8"
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      {config.end ? (
        <button
          type="button"
          onClick={toggleCurrent}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
            saved
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border text-foreground hover:bg-accent/40"
          }`}
        >
          <Star size={13} aria-hidden fill={saved ? "currentColor" : "none"} />
          {saved ? "이 경로 저장됨 — 해제" : "지금 경로 저장"}
        </button>
      ) : null}

      {list.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          자주 가는 길을 저장해 두면 여기서 한 번에 불러옵니다. 출발지를 &lsquo;현재
          위치&rsquo;로 저장하면 어디에서든 그 목적지로 안내합니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((f) => (
            <li key={f.id} className="flex items-stretch gap-1">
              <button
                type="button"
                onClick={() => {
                  onLoad({
                    start: f.start,
                    end: f.end,
                    avoidStairs: f.avoidStairs,
                  });
                  onClose();
                }}
                className="min-w-0 flex-1 truncate rounded-md border border-border px-2 py-1.5 text-left text-xs text-foreground outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                {favoriteLabel(f)}
                {f.avoidStairs ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    · 계단 없이
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setList(unstarRoute(f.id))}
                aria-label={`${favoriteLabel(f)} 즐겨찾기에서 삭제`}
                className="inline-flex w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground outline-none transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:w-9"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default FavoritesPanel;
