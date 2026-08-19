"use client";

/**
 * memo · MemoLinks — 본문에 적힌 웹주소를 클릭 가능한 링크로 노출.
 *
 *  메모 본문은 textarea(평문)라 그 안의 주소는 절대 클릭할 수 없다(노트처럼
 *  리치텍스트가 아니다). 그래서 본문 아래에 주소만 모아 새 탭 링크로 보여준다 —
 *  링크가 실제로 연결되고, 라벨이 호스트 이름이라 어느 사이트인지도 바로 보인다.
 *  타일·전체보기가 같은 컴포넌트를 쓴다.
 */

import * as React from "react";
import { Link2 } from "lucide-react";
import { findUrls, urlHost } from "@/components/widgets/shared/urls";

export function MemoLinks({ text }: { text: string }) {
  const links = React.useMemo(() => {
    const seen = new Set<string>();
    return findUrls(text).filter((u) => {
      if (seen.has(u.href)) return false;
      seen.add(u.href);
      return true;
    });
  }, [text]);

  if (links.length === 0) return null;

  return (
    <div className="flex max-h-14 shrink-0 flex-wrap items-center gap-1 overflow-y-auto border-t border-border/60 pt-1">
      <Link2 size={12} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="sr-only">본문 속 링크</span>
      {links.map((u) => (
        <a
          key={u.href}
          href={u.href}
          target="_blank"
          rel="noopener noreferrer"
          title={u.href}
          // 타일에서 링크를 눌렀을 때 그리드 드래그가 클릭을 가로채지 않게.
          data-pb-no-drag=""
          onPointerDown={(e) => e.stopPropagation()}
          className="max-w-[12rem] truncate rounded border border-border bg-background/60 px-1.5 py-0.5 text-[11px] text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {urlHost(u.href)}
        </a>
      ))}
    </div>
  );
}

export default MemoLinks;
