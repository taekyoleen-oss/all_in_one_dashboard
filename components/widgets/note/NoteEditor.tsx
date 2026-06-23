"use client";

/**
 * note · NoteEditor — the full rich-text editing surface (전체 편집).
 *
 *  An UNCONTROLLED contentEditable (initial HTML set once via ref so optimistic
 *  config updates never reset the caret — same approach as memo's inline edit).
 *  Edits persist through the widget-persistence context (debounced; flushed on
 *  blur). Pasted/dropped content is sanitized before insertion; pasted/dropped
 *  images are downscaled and inlined. The Toolbar drives formatting; Attachments
 *  manages inline files.
 *
 *  Stored value = sanitizeHtml(editor.innerHTML): we sanitize the SAVED string
 *  without rewriting the live DOM, so the caret is never disturbed.
 */

import * as React from "react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { Toolbar } from "./Toolbar";
import { Attachments } from "./Attachments";
import { ImageResizer } from "./ImageResizer";
import { sanitizeHtml } from "./sanitize";
import { imageToDataUrl } from "./media";
import * as RT from "./richText";
import { queryActiveMarks, type ActiveMarks } from "./richText";
import type { NoteConfig, NoteAttachment } from "./types";

/** Shared prose styling for both the editor and the read-only preview. */
export const NOTE_PROSE_CLASS = [
  "leading-relaxed text-foreground",
  "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:my-2",
  "[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:my-2",
  "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:my-1.5",
  "[&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5",
  "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:my-2",
  "[&_a]:text-primary [&_a]:underline",
  "[&_img]:rounded-md [&_img]:my-1 [&_img]:max-w-full",
  "[&_table]:border-collapse [&_table]:my-2 [&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:p-1.5",
  "[&_hr]:my-3 [&_hr]:border-border",
  "[&_pre]:bg-muted [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:overflow-x-auto",
  "[&_code]:font-mono",
].join(" ");

export function NoteEditor({
  config,
  instanceId,
}: {
  config: NoteConfig;
  instanceId: string;
}) {
  const save = useSaveWidgetConfig();
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);
  const configRef = React.useRef(config);
  configRef.current = config;
  const timer = React.useRef<number | null>(null);

  const [active, setActive] = React.useState<ActiveMarks>({
    bold: false, italic: false, underline: false, strike: false, ul: false, ol: false,
  });
  const [inTable, setInTable] = React.useState(false);

  // Set the initial HTML exactly once (uncontrolled thereafter).
  React.useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = sanitizeHtml(config.html);
    }
    RT.enableCssStyling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const persist = React.useCallback(
    (debounce: boolean) => {
      const el = editorRef.current;
      if (!el) return;
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      const run = () => {
        const html = sanitizeHtml(el.innerHTML);
        save(instanceId, { ...configRef.current, html, updatedAt: Date.now() });
      };
      if (debounce) timer.current = window.setTimeout(run, 600);
      else run();
    },
    [instanceId, save],
  );

  const saveAttachments = React.useCallback(
    (attachments: NoteAttachment[]) => {
      save(instanceId, { ...configRef.current, attachments, updatedAt: Date.now() });
    },
    [instanceId, save],
  );

  // Refresh toolbar active states from the live selection (only when in editor).
  const refresh = React.useCallback(() => {
    const el = editorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    if (!el.contains(sel.anchorNode)) return;
    setActive(queryActiveMarks());
    setInTable(RT.isInTable(el));
  }, []);

  React.useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [refresh]);

  React.useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  const onAfter = React.useCallback(() => {
    refresh();
    persist(false);
  }, [refresh, persist]);

  const insertImageFiles = React.useCallback(
    async (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (imgs.length === 0) return false;
      editorRef.current?.focus();
      for (const f of imgs) {
        const url = await imageToDataUrl(f);
        RT.insertImage(url);
      }
      persist(false);
      return true;
    },
    [persist],
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
      persist(true);
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
    <div className="flex h-full min-h-0 flex-col gap-2" data-pb-no-drag="">
      <Toolbar
        editorRef={editorRef}
        active={active}
        inTable={inTable}
        onAfter={onAfter}
        onPickImage={() => imageInputRef.current?.click()}
      />

      <div ref={wrapperRef} className="relative min-h-40 flex-1">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="노트 본문"
          spellCheck
          data-pb-no-drag=""
          onInput={() => {
            persist(true);
            refresh();
          }}
          onBlur={() => persist(false)}
          onKeyUp={refresh}
          onMouseUp={refresh}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer?.items ?? []).some((i) => i.kind === "file"))
              e.preventDefault();
          }}
          className={[
            "h-full w-full overflow-y-auto pb-scroll rounded-md border border-border bg-background px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:italic",
            NOTE_PROSE_CLASS,
          ].join(" ")}
          data-placeholder="여기에 강의 내용을 기록하세요… (붙여넣기·이미지·표·이미지 크기조절 지원)"
        />
        <ImageResizer
          editorRef={editorRef}
          containerRef={wrapperRef}
          onChange={() => persist(false)}
        />
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void insertImageFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <Attachments
        attachments={config.attachments}
        onChange={saveAttachments}
        onInsertImage={(dataUrl) => {
          editorRef.current?.focus();
          RT.insertImage(dataUrl);
          persist(false);
        }}
      />
    </div>
  );
}

export default NoteEditor;
