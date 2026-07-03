"use client";

/**
 * note · RichTextArea — 언컨트롤드 리치텍스트 편집 영역 1개(NoteEditor에서 추출).
 *
 *  머리말 본문과 각 소제목 섹션이 같은 편집 표면(contentEditable + 붙여넣기/드롭
 *  살균 + 이미지 인라인 + ImageResizer)을 공유한다. 저장은 부모(NoteEditor)가
 *  소유 — 이 컴포넌트는 onPersist(key, debounce)로 신호만 보내고, 부모가 등록된
 *  엘리먼트의 innerHTML을 읽어 올바른 슬롯(config.html / sections[i].html)에
 *  기록한다. 에디터 여러 개가 한 config를 나눠 쓰기 위한 구조다.
 *
 *  초기 HTML은 resetKey당 한 번만 주입(언컨트롤드) — 낙관적 config 갱신이 캐럿을
 *  건드리지 않는다(기존 NoteEditor 방식 그대로).
 */

import * as React from "react";
import { ImageResizer } from "./ImageResizer";
import { sanitizeHtml } from "./sanitize";
import { imageToDataUrl } from "./media";
import * as RT from "./richText";
import { NOTE_PROSE_CLASS } from "./prose";

export function RichTextArea({
  editorKey,
  initialHtml,
  resetKey,
  placeholder,
  fill,
  slim,
  ariaLabel,
  registerEl,
  onPersist,
  onActivity,
}: {
  /** 부모의 에디터 레지스트리 키(머리말 센티널 또는 섹션 id). */
  editorKey: string;
  initialHtml: string;
  /** 이 값이 바뀔 때만 innerHTML을 다시 주입(언컨트롤드 리셋 경계). */
  resetKey: string;
  placeholder: string;
  /** true = 남은 높이를 채우고 내부 스크롤(단독 편집), false = 내용만큼 자라남(스택). */
  fill: boolean;
  /**
   * 스택(fill=false) 전용: 최소 높이를 한 줄로 줄인다 — 비어 있을 때 큰 빈 영역을
   * 차지하지 않는 선택 영역(머리말)용. 내용이 생기면 그만큼 자라는 건 동일.
   */
  slim?: boolean;
  ariaLabel: string;
  registerEl: (key: string, el: HTMLDivElement | null) => void;
  onPersist: (key: string, debounce: boolean) => void;
  onActivity: () => void;
}) {
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  // ref 콜백은 반드시 memoize — 인라인 화살표면 렌더마다 새 함수라 React가
  // detach(null)→reattach를 반복하고, 부모의 활성 영역 추적(registerEl)이
  // 렌더마다 리셋돼 툴바가 엉뚱한 영역(첫 등록 영역)에 적용된다.
  const setEditorRef = React.useCallback(
    (el: HTMLDivElement | null) => {
      editorRef.current = el;
      registerEl(editorKey, el);
    },
    [editorKey, registerEl],
  );

  // Set the initial HTML exactly once per resetKey (uncontrolled thereafter).
  React.useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = sanitizeHtml(initialHtml);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const insertImageFiles = React.useCallback(
    async (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) return false;
      editorRef.current?.focus();
      for (const f of imgs) {
        const url = await imageToDataUrl(f);
        RT.insertImage(url);
      }
      onPersist(editorKey, false);
      return true;
    },
    [editorKey, onPersist],
  );

  const onPaste = (e: React.ClipboardEvent) => {
    const cd = e.clipboardData;
    if (!cd) return;
    // Pasted image file(s) → downscale + inline.
    const files = Array.from(cd.files ?? []);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void insertImageFiles(files);
      return;
    }
    // Pasted rich HTML → sanitize then insert; else plain text.
    const html = cd.getData("text/html");
    if (html) {
      e.preventDefault();
      RT.insertHtml(sanitizeHtml(html));
      onPersist(editorKey, true);
      return;
    }
    // Plain text falls through to the browser's default (debounced save fires on input).
  };

  const onDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void insertImageFiles(files);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={fill ? "relative min-h-40 flex-1" : "relative"}
    >
      <div
        ref={setEditorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        spellCheck
        data-pb-no-drag=""
        onInput={() => {
          onPersist(editorKey, true);
          onActivity();
        }}
        onBlur={() => onPersist(editorKey, false)}
        onKeyUp={onActivity}
        onMouseUp={onActivity}
        onFocus={onActivity}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer?.items ?? []).some((i) => i.kind === "file"))
            e.preventDefault();
        }}
        className={[
          fill
            ? "h-full w-full overflow-y-auto pb-scroll"
            : slim
              ? "min-h-10 w-full"
              : "min-h-28 w-full",
          "rounded-md border border-border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:italic",
          NOTE_PROSE_CLASS,
        ].join(" ")}
        data-placeholder={placeholder}
      />
      <ImageResizer
        editorRef={editorRef}
        containerRef={wrapperRef}
        onChange={() => onPersist(editorKey, false)}
      />
    </div>
  );
}

export default RichTextArea;
