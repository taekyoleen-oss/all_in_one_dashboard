"use client";

/**
 * note · ImageResizer — click an image in the note to resize it (이미지 크기 조절).
 *
 *  contentEditable has no reliable native image resizing in Chromium, so this
 *  draws a custom selection overlay over the clicked <img>: a bottom-right drag
 *  handle (pointer drag → sets the image's inline width, height stays auto to keep
 *  the aspect ratio) plus quick size presets (작게/중간/크게/원본). The width is an
 *  inline style the sanitizer preserves, so the size round-trips through config.
 *
 *  The overlay is absolutely positioned inside the editor's relative wrapper and
 *  re-measured on scroll/resize/drag; it hides when the image scrolls out of view
 *  or the caret moves on. After any change `onChange()` persists.
 */

import * as React from "react";
import { Image as ImageIcon } from "lucide-react";

interface OverlayRect {
  top: number;
  left: number;
  width: number;
  height: number;
  belowBar: boolean;
}

export function ImageResizer({
  editorRef,
  containerRef,
  onChange,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onChange: () => void;
}) {
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [rect, setRect] = React.useState<OverlayRect | null>(null);
  const draggingRef = React.useRef(false);

  const reposition = React.useCallback(() => {
    const editor = editorRef.current;
    const container = containerRef.current;
    if (!img || !editor || !container || !editor.contains(img)) {
      setRect(null);
      return;
    }
    const ir = img.getBoundingClientRect();
    const er = editor.getBoundingClientRect();
    // Hide when the image is scrolled out of the editor's visible area.
    if (ir.bottom < er.top + 4 || ir.top > er.bottom - 4) {
      setRect(null);
      return;
    }
    const cr = container.getBoundingClientRect();
    const top = ir.top - cr.top;
    setRect({
      top,
      left: ir.left - cr.left,
      width: ir.width,
      height: ir.height,
      belowBar: top < 36, // place the toolbar under the image if near the top
    });
  }, [img, editorRef, containerRef]);

  // Select an image on click; clear when clicking elsewhere in the editor.
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target;
      setImg(t instanceof HTMLImageElement ? t : null);
    };
    const onKeyDown = () => {
      if (!draggingRef.current) setImg(null);
    };
    editor.addEventListener("click", onClick);
    editor.addEventListener("keydown", onKeyDown);
    return () => {
      editor.removeEventListener("click", onClick);
      editor.removeEventListener("keydown", onKeyDown);
    };
  }, [editorRef]);

  React.useLayoutEffect(reposition, [reposition]);

  // Keep the overlay glued to the image during scroll / resize.
  React.useEffect(() => {
    if (!img) return;
    const editor = editorRef.current;
    const handler = () => reposition();
    editor?.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler);
    return () => {
      editor?.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [img, reposition, editorRef]);

  const maxWidth = () => {
    const editor = editorRef.current;
    // content width minus horizontal padding (px-3 = 24px total).
    return editor ? Math.max(60, editor.clientWidth - 28) : 800;
  };

  /* eslint-disable react-hooks/immutability -- contentEditable 에디터의 이미지 inline width 직접 조작: 에디터 DOM은 언컨트롤드 외부 시스템(변경분은 onChange→살균→config로 왕복) */
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!img) return;
    draggingRef.current = true;
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const cap = maxWidth();
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(40, Math.min(cap, Math.round(startW + (ev.clientX - startX))));
      img.style.width = `${w}px`;
      img.style.height = "auto";
      reposition();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      draggingRef.current = false;
      onChange();
      reposition();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const setPreset = (frac: number | null) => {
    if (!img) return;
    if (frac === null) {
      img.style.width = "";
    } else {
      img.style.width = `${Math.round(maxWidth() * frac)}px`;
    }
    img.style.height = "auto";
    onChange();
    reposition();
  };
  // (enable은 컴포넌트 끝에서 — JSX의 setPreset/startDrag 클로저 호출도 같은 이유로 허용)

  if (!img || !rect) return null;

  const presetBtn =
    "pointer-events-auto rounded px-1.5 py-0.5 text-[11px] text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      data-pb-no-drag=""
      className="pointer-events-none absolute z-10"
      style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
    >
      {/* Selection ring */}
      <div className="absolute inset-0 rounded-sm ring-2 ring-primary ring-offset-1 ring-offset-background" />

      {/* Size presets */}
      <div
        className="pointer-events-none absolute left-0 flex items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-md"
        style={rect.belowBar ? { top: rect.height + 6 } : { top: -32 }}
      >
        <span className="pointer-events-none px-1 text-muted-foreground">
          <ImageIcon size={12} aria-hidden />
        </span>
        <button type="button" data-pb-no-drag="" className={presetBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={() => setPreset(0.4)}>작게</button>
        <button type="button" data-pb-no-drag="" className={presetBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={() => setPreset(0.7)}>중간</button>
        <button type="button" data-pb-no-drag="" className={presetBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={() => setPreset(1)}>크게</button>
        <button type="button" data-pb-no-drag="" className={presetBtn}
          onMouseDown={(e) => e.preventDefault()} onClick={() => setPreset(null)}>원본</button>
      </div>

      {/* Corner drag handle (bottom-right) */}
      <button
        type="button"
        data-pb-no-drag=""
        aria-label="이미지 크기 조절 손잡이"
        onPointerDown={startDrag}
        onMouseDown={(e) => e.preventDefault()}
        className="pointer-events-auto absolute -bottom-1.5 -right-1.5 size-3.5 cursor-nwse-resize rounded-sm border-2 border-background bg-primary shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}
/* eslint-enable react-hooks/immutability */

export default ImageResizer;
