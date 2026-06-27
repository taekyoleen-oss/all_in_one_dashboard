"use client";

/**
 * note · Toolbar — formatting controls for the editor (서식 도구).
 *
 *  Presentational: it calls the richText command helpers against the editor
 *  element (passed by ref), then `onAfter()` so the Editor can re-focus, persist,
 *  and refresh active-mark highlighting. Color/size/table controls use small
 *  local popovers. Everything carries data-pb-no-drag so toolbar clicks never
 *  start a grid drag.
 */

import * as React from "react";
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Quote, Minus, Link2,
  Image as ImageIcon, Table as TableIcon, Baseline, Highlighter,
  Heading2, Heading3, RemoveFormatting, Undo2, Redo2,
  Rows3, Columns3, Trash2,
} from "lucide-react";
import * as RT from "./richText";
import { FONT_SIZES, TEXT_COLORS, HIGHLIGHT_COLORS, AUTO_TEXT_COLOR } from "./types";
import type { ActiveMarks } from "./richText";

const btn =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
const btnActive = "bg-primary/15 text-foreground";
const sep = "mx-0.5 h-6 w-px shrink-0 self-center bg-border";

function IconBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      data-pb-no-drag=""
      // Keep the editor selection — prevent the button from stealing focus.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={[btn, active ? btnActive : ""].join(" ")}
    >
      {children}
    </button>
  );
}

/** A click-to-open popover anchored under a trigger button. */
function Popover({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative" data-pb-no-drag="">
      <button
        type="button"
        title={title}
        aria-label={title}
        data-pb-no-drag=""
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        className={[btn, open ? btnActive : ""].join(" ")}
      >
        {icon}
      </button>
      {open ? (
        <div
          data-pb-no-drag=""
          className="absolute left-0 top-full z-20 mt-1 rounded-md border border-border bg-popover p-2 shadow-lg"
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

function Swatches({
  colors,
  onPick,
}: {
  colors: string[];
  onPick: (c: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          data-pb-no-drag=""
          aria-label={c === "transparent" ? "형광펜 제거" : c}
          title={c === "transparent" ? "제거" : c}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c)}
          className="size-6 rounded border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{
            background:
              c === "transparent"
                ? "repeating-linear-gradient(45deg,var(--muted),var(--muted) 3px,transparent 3px,transparent 6px)"
                : c,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Text-color menu: 자동(테마) + preset swatches + a custom color picker.
 *
 *  The native <input type="color"> must take focus to open, which would collapse
 *  the editor selection — so we snapshot the selection Range when the menu opens
 *  (the trigger button used onMouseDown→preventDefault, so the selection is still
 *  intact at mount) and restore it right before applying any color.
 */
function ColorMenu({
  editorRef,
  onApplied,
  close,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  onApplied: () => void;
  close: () => void;
}) {
  const savedRange = React.useRef<Range | null>(null);
  const [custom, setCustom] = React.useState("#ef4444");

  React.useEffect(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }, [editorRef]);

  const apply = (color: string) => {
    const el = editorRef.current;
    el?.focus();
    const r = savedRange.current;
    if (r) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }
    RT.setForeColor(color);
    onApplied();
    close();
  };

  return (
    <div className="flex w-40 flex-col gap-2" data-pb-no-drag="">
      <button
        type="button"
        data-pb-no-drag=""
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => apply(AUTO_TEXT_COLOR)}
        title="기본 — 라이트 모드=검정 · 다크 모드=흰색 (테마 자동)"
        className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className="size-4 shrink-0 rounded border border-border bg-foreground"
        />
        기본 (라이트=검정·다크=흰색)
      </button>

      <Swatches colors={TEXT_COLORS} onPick={apply} />

      <label
        className="flex items-center gap-1.5 text-xs text-muted-foreground"
        data-pb-no-drag=""
      >
        <span className="shrink-0">직접</span>
        <input
          type="color"
          value={custom}
          data-pb-no-drag=""
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setCustom(e.target.value)}
          className="h-7 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
          aria-label="직접 색 선택"
        />
        <button
          type="button"
          data-pb-no-drag=""
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => apply(custom)}
          className="ml-auto rounded-md border border-border px-2 py-1 text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          적용
        </button>
      </label>
    </div>
  );
}

function TableGrid({ onPick }: { onPick: (r: number, c: number) => void }) {
  const [hover, setHover] = React.useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const N = 6;
  const M = 6;
  return (
    <div className="flex flex-col gap-1" data-pb-no-drag="">
      <div className="grid grid-cols-6 gap-0.5">
        {Array.from({ length: N * M }).map((_, i) => {
          const r = Math.floor(i / M) + 1;
          const c = (i % M) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              type="button"
              data-pb-no-drag=""
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => onPick(r, c)}
              className={`size-4 rounded-[2px] border ${
                on ? "border-primary bg-primary/30" : "border-border bg-background"
              }`}
            />
          );
        })}
      </div>
      <span className="text-center text-[11px] text-muted-foreground">
        {hover.r > 0 ? `${hover.r} × ${hover.c}` : "표 크기 선택"}
      </span>
    </div>
  );
}

export function Toolbar({
  editorRef,
  active,
  inTable,
  onAfter,
  onPickImage,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  active: ActiveMarks;
  inTable: boolean;
  onAfter: () => void;
  onPickImage: () => void;
}) {
  const ed = () => editorRef.current;
  const run = (fn: () => void) => {
    ed()?.focus();
    fn();
    onAfter();
  };

  return (
    <div
      data-pb-no-drag=""
      className="flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-card/60 p-1"
    >
      <IconBtn title="실행 취소" onClick={() => run(RT.undo)}><Undo2 size={16} /></IconBtn>
      <IconBtn title="다시 실행" onClick={() => run(RT.redo)}><Redo2 size={16} /></IconBtn>
      <span className={sep} />

      {/* Font size */}
      <select
        title="글자 크기"
        aria-label="글자 크기"
        data-pb-no-drag=""
        defaultValue=""
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const px = Number(e.target.value);
          if (px) run(() => RT.applyFontSize(ed()!, px));
          e.target.value = "";
        }}
        className="h-8 rounded-md border border-border bg-background px-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="" disabled>크기</option>
        {FONT_SIZES.map((f) => (
          <option key={f.px} value={f.px}>{f.label} ({f.px})</option>
        ))}
      </select>

      {/* 글자 색 — 글자 크기 바로 옆(노트 타일 색과는 별개 기능). '기본' = 테마 자동. */}
      <Popover title="글자 색" icon={<Baseline size={16} />}>
        {(close) => (
          <ColorMenu editorRef={editorRef} onApplied={onAfter} close={close} />
        )}
      </Popover>
      <Popover title="형광펜" icon={<Highlighter size={16} />}>
        {(close) => (
          <Swatches colors={HIGHLIGHT_COLORS} onPick={(c) => { run(() => RT.setHiliteColor(c)); close(); }} />
        )}
      </Popover>
      <span className={sep} />

      <IconBtn title="제목" onClick={() => run(() => RT.formatBlock("H2"))}><Heading2 size={16} /></IconBtn>
      <IconBtn title="소제목" onClick={() => run(() => RT.formatBlock("H3"))}><Heading3 size={16} /></IconBtn>
      <span className={sep} />

      <IconBtn title="굵게" active={active.bold} onClick={() => run(RT.toggleBold)}><Bold size={16} /></IconBtn>
      <IconBtn title="기울임" active={active.italic} onClick={() => run(RT.toggleItalic)}><Italic size={16} /></IconBtn>
      <IconBtn title="밑줄" active={active.underline} onClick={() => run(RT.toggleUnderline)}><Underline size={16} /></IconBtn>
      <IconBtn title="취소선" active={active.strike} onClick={() => run(RT.toggleStrike)}><Strikethrough size={16} /></IconBtn>
      <span className={sep} />

      <IconBtn title="글머리 기호" active={active.ul} onClick={() => run(RT.bulletList)}><List size={16} /></IconBtn>
      <IconBtn title="번호 매기기" active={active.ol} onClick={() => run(RT.numberList)}><ListOrdered size={16} /></IconBtn>
      <IconBtn title="왼쪽 정렬" onClick={() => run(RT.alignLeft)}><AlignLeft size={16} /></IconBtn>
      <IconBtn title="가운데 정렬" onClick={() => run(RT.alignCenter)}><AlignCenter size={16} /></IconBtn>
      <IconBtn title="오른쪽 정렬" onClick={() => run(RT.alignRight)}><AlignRight size={16} /></IconBtn>
      <IconBtn title="인용" onClick={() => run(() => RT.formatBlock("BLOCKQUOTE"))}><Quote size={16} /></IconBtn>
      <IconBtn title="구분선" onClick={() => run(() => RT.insertHtml("<hr/>"))}><Minus size={16} /></IconBtn>
      <span className={sep} />

      <IconBtn title="이미지 삽입" onClick={onPickImage}><ImageIcon size={16} /></IconBtn>
      <IconBtn
        title="링크"
        onClick={() => {
          const url = window.prompt("링크 주소(URL)를 입력하세요", "https://");
          if (url) run(() => RT.insertLink(url));
        }}
      >
        <Link2 size={16} />
      </IconBtn>
      <Popover title="표 삽입" icon={<TableIcon size={16} />}>
        {(close) => (
          <TableGrid onPick={(r, c) => { run(() => RT.insertTable(r, c)); close(); }} />
        )}
      </Popover>

      {inTable ? (
        <span className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-muted/50 px-1">
          <IconBtn title="행 추가" onClick={() => run(() => RT.tableAddRow(ed()!))}><Rows3 size={15} /></IconBtn>
          <IconBtn title="열 추가" onClick={() => run(() => RT.tableAddColumn(ed()!))}><Columns3 size={15} /></IconBtn>
          <IconBtn title="행 삭제" onClick={() => run(() => RT.tableDeleteRow(ed()!))}>
            <span className="relative"><Rows3 size={15} /><Minus size={9} className="absolute -right-1 -top-1 text-destructive" /></span>
          </IconBtn>
          <IconBtn title="열 삭제" onClick={() => run(() => RT.tableDeleteColumn(ed()!))}>
            <span className="relative"><Columns3 size={15} /><Minus size={9} className="absolute -right-1 -top-1 text-destructive" /></span>
          </IconBtn>
          <IconBtn title="표 삭제" onClick={() => run(() => RT.tableDelete(ed()!))}><Trash2 size={15} /></IconBtn>
        </span>
      ) : null}

      <span className={sep} />
      <IconBtn title="서식 지우기" onClick={() => run(RT.clearFormat)}><RemoveFormatting size={16} /></IconBtn>
    </div>
  );
}

export default Toolbar;
