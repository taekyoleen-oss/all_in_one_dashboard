"use client";

/**
 * ============================================================================
 *  WidgetPopover — 제목 줄 '더보기'가 여는 팝업(요구)
 * ============================================================================
 *
 *  요구 그대로다: 타일은 제목만 남겨 두고, 더 보고 싶을 때 **팝업이 아래로 길게
 *  펼쳐져** 내용을 많이 보여 준다. 단 **화면 전체를 가리지 않는다** —
 *  전체보기(FocusOverlay)와 다른 점이 바로 이것이라 따로 만들었다:
 *
 *   • 스크림(어두운 배경)이 없다. 뒤 캔버스가 그대로 보이고 읽을 수 있다.
 *   • 타일 위치에서 시작해 **화면 아래 끝 근처까지** 늘어난다(내용이 길면 내부 스크롤).
 *   • 폭은 타일 폭 이상(좁은 타일도 읽을 만하게), 화면을 넘지 않게 클램프.
 *
 *  닫기: ✕ · Esc · 바깥 클릭 · 뒤로가기(useBackStack 키 `popover:{id}`).
 *  스크림이 없으므로 **바깥 클릭을 document에서 직접 듣는다**(투명 오버레이를 깔면
 *  그것도 결국 화면을 덮어 캔버스 조작을 막는다 — 요구와 어긋난다).
 *
 *  내용은 전체보기와 같은 `ExpandedView`를 쓴다(위젯마다 팝업용 뷰를 새로 만들지
 *  않는다). 더 크게 보고 싶으면 헤더의 '전체'로 승격한다.
 * ============================================================================
 */

import * as React from "react";
import { Maximize2, X } from "lucide-react";
import type { WidgetRegistry } from "@/lib/widgets/contract";
import type { WidgetInstance } from "@/components/canvas/GridCanvas";
import { IconButton } from "@/components/ui/primitives";

/** 팝업 최소 폭 — 좁은 타일에서 열어도 내용이 읽히도록. */
const MIN_WIDTH = 420;
/** 화면 가장자리 여백. */
const MARGIN = 12;
/**
 * 팝업이 확보하려는 높이(화면의 60%, 최대 520px). 타일이 화면 아래쪽에 있으면
 * 그 자리에서 아래로 펴 봐야 몇 줄 못 보여 주므로(실측: 148px) **위로 올려 잡아**
 * 이만큼은 보이게 한다 — 요구의 "아래까지 길어져서 더 보이도록".
 */
function wantedHeight(vh: number): number {
  return Math.min(Math.round(vh * 0.6), 520);
}

export interface WidgetPopoverProps {
  registry: WidgetRegistry;
  instance: WidgetInstance | null;
  open: boolean;
  onClose: () => void;
  /** '전체' — 같은 위젯을 전체보기로 승격. */
  onExpand?: () => void;
}

interface Box {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

/** 타일 위치에서 시작해 화면 아래까지 늘어나는 상자(화면 밖으로 안 나가게 클램프). */
function boxFor(instanceId: string): Box {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const el = document.querySelector<HTMLElement>(
    `[data-pb-instance="${instanceId}"]`,
  );
  const r = el?.getBoundingClientRect();
  const width = Math.min(Math.max(r?.width ?? MIN_WIDTH, MIN_WIDTH), vw - MARGIN * 2);
  const left = Math.min(Math.max(r?.left ?? MARGIN, MARGIN), vw - width - MARGIN);
  // 타일 위쪽에서 시작하되, 아래 공간이 모자라면 위로 올려 최소 높이를 확보한다.
  const highest = Math.max(MARGIN, vh - wantedHeight(vh) - MARGIN);
  const top = Math.min(Math.max(r?.top ?? MARGIN, MARGIN), highest);
  return { left, top, width, maxHeight: vh - top - MARGIN };
}

export function WidgetPopover({
  registry,
  instance,
  open,
  onClose,
  onExpand,
}: WidgetPopoverProps) {
  const visible = open && !!instance;
  const instanceId = instance?.instanceId ?? null;
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<Box | null>(null);

  // 열릴 때 위치를 잡고, 스크롤·리사이즈에 따라 다시 잡는다(타일이 움직이므로).
  React.useLayoutEffect(() => {
    if (!visible || !instanceId) return;
    const place = () => setBox(boxFor(instanceId));
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [visible, instanceId]);

  // Esc + 바깥 클릭으로 닫기(스크림이 없으므로 document에서 듣는다).
  React.useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    const onDown = (e: PointerEvent) => {
      const el = panelRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // capture 단계 — 캔버스가 pointerdown을 먼저 소비해도 닫히게.
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [visible, onClose]);

  if (!visible || !instance || !box) return null;

  const def = registry[instance.type];
  if (!def) return null;
  const Expanded = def.ExpandedView;
  const title =
    (def.instanceTitle ? def.instanceTitle(instance.config) : null) ||
    def.displayName ||
    instance.type;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${title} 더보기`}
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        maxHeight: box.maxHeight,
      }}
      className={[
        "fixed z-[55] flex flex-col overflow-hidden",
        "rounded-[var(--radius)] border-2 border-border bg-card text-card-foreground",
        "shadow-2xl ring-1 ring-black/10",
        "motion-safe:animate-[pb-overlay-in_160ms_ease-out]",
      ].join(" ")}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
        {onExpand ? (
          <IconButton label="전체 화면으로 보기" onClick={onExpand}>
            <Maximize2 size={16} />
          </IconButton>
        ) : null}
        <IconButton label="더보기 닫기" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <Expanded config={instance.config} instanceId={instance.instanceId} />
      </div>
    </div>
  );
}

export default WidgetPopover;
