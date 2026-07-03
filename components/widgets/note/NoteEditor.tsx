"use client";

/**
 * note · NoteEditor — the full rich-text editing surface (전체 편집).
 *
 *  머리말 본문(config.html) + 소제목 섹션들(config.sections)을 한 화면에 세로로
 *  쌓아 편집한다. 편집 영역은 여러 개지만 툴바는 하나 — 마지막으로 포커스/선택이
 *  들어간 영역(activeEditorRef)을 따라간다(richText 명령이 selection 기반이라 가능).
 *
 *  `sectionId`가 주어지면 그 섹션만 단독 편집한다(타일에서 소제목 클릭 → 해당
 *  섹션만 보기). 섹션이 없으면 기존 단일 본문 노트와 동일한 화면이다.
 *
 *  저장 소유권: 각 RichTextArea는 onPersist(key)로 신호만 보내고, 여기서 등록된
 *  엘리먼트의 innerHTML을 sanitize해 올바른 슬롯에 기록한다(에디터별 디바운스).
 *  Stored value = sanitizeHtml(editor.innerHTML): 저장 문자열만 살균하고 라이브
 *  DOM은 다시 쓰지 않아 캐럿이 흔들리지 않는다.
 */

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { Toolbar } from "./Toolbar";
import { Attachments } from "./Attachments";
import { RichTextArea } from "./RichTextArea";
import { sanitizeHtml } from "./sanitize";
import { imageToDataUrl } from "./media";
import * as RT from "./richText";
import { queryActiveMarks, type ActiveMarks } from "./richText";
import {
  createSection,
  moveSectionById,
  removeSectionById,
  updateSectionById,
} from "./sections";
import type { NoteConfig, NoteAttachment, NoteSection } from "./types";

// 순환 import 없이 CompactView와 공유하도록 prose.ts로 이동 — 재노출(기존 import 경로 호환).
export { NOTE_PROSE_CLASS } from "./prose";

/** 머리말(config.html) 영역의 에디터 레지스트리 키 — 섹션 id(uuid)와 충돌 불가. */
const INTRO_KEY = "__intro__";

export function NoteEditor({
  config,
  instanceId,
  sectionId,
}: {
  config: NoteConfig;
  instanceId: string;
  /** 지정 시 그 섹션만 단독 편집(소제목 클릭 → 해당 내용만 보기). */
  sectionId?: string | null;
}) {
  const save = useSaveWidgetConfig();
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);
  const configRef = React.useRef(config);
  // 최신 config 미러 — 렌더 중 ref 쓰기 대신 커밋 후 동기화(react-hooks/refs).
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);

  /** 등록된 편집 영역들(key → element)과 툴바가 조작할 활성 영역. */
  const editorsRef = React.useRef(new Map<string, HTMLDivElement>());
  const activeKeyRef = React.useRef<string>(INTRO_KEY);
  const activeEditorRef = React.useRef<HTMLDivElement | null>(null);
  /** 영역별 디바운스 타이머(에디터 key·제목 key 공용). */
  const timersRef = React.useRef(new Map<string, number>());

  const [active, setActive] = React.useState<ActiveMarks>({
    bold: false, italic: false, underline: false, strike: false, ul: false, ol: false,
  });
  const [inTable, setInTable] = React.useState(false);
  /** 2단계 섹션 삭제 확인(휴지통 → '삭제') 대상 id. */
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    RT.enableCssStyling();
  }, []);

  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const t of timers.values()) window.clearTimeout(t);
      timers.clear();
    };
  }, []);

  const registerEl = React.useCallback((key: string, el: HTMLDivElement | null) => {
    const map = editorsRef.current;
    if (el) {
      map.set(key, el);
      // 아직 활성 영역이 없으면 첫 등록 영역으로 — 포커스 전 툴바 클릭이
      // 기존(단일 에디터) 동작처럼 첫 본문에 적용되게 한다.
      if (!activeEditorRef.current) {
        activeKeyRef.current = key;
        activeEditorRef.current = el;
      }
    } else {
      map.delete(key);
      if (activeKeyRef.current === key) {
        const first = map.entries().next();
        activeKeyRef.current = first.done ? INTRO_KEY : first.value[0];
        activeEditorRef.current = first.done ? null : first.value[1];
      }
    }
  }, []);

  /** key 영역의 innerHTML을 살균해 올바른 슬롯(html/sections[i].html)에 저장. */
  const persistKey = React.useCallback(
    (key: string, debounce: boolean) => {
      const timers = timersRef.current;
      const t = timers.get(key);
      if (t != null) {
        window.clearTimeout(t);
        timers.delete(key);
      }
      const run = () => {
        timers.delete(key);
        const el = editorsRef.current.get(key);
        if (!el) return;
        const html = sanitizeHtml(el.innerHTML);
        const cfg = configRef.current;
        if (key === INTRO_KEY) {
          save(instanceId, { ...cfg, html, updatedAt: Date.now() });
        } else {
          const cur = cfg.sections ?? [];
          const sections = updateSectionById(cur, key, { html, updatedAt: Date.now() });
          if (sections === cur) return; // 섹션이 이미 삭제됨 — 늦은 디바운스 무시
          save(instanceId, { ...cfg, sections, updatedAt: Date.now() });
        }
      };
      if (debounce) timers.set(key, window.setTimeout(run, 600));
      else run();
    },
    [instanceId, save],
  );

  // Refresh toolbar state from the live selection + retarget the active area.
  const refresh = React.useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    for (const [key, el] of editorsRef.current) {
      if (el.contains(sel.anchorNode)) {
        activeKeyRef.current = key;
        activeEditorRef.current = el;
        setActive(queryActiveMarks());
        setInTable(RT.isInTable(el));
        return;
      }
    }
  }, []);

  React.useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, [refresh]);

  const onAfter = React.useCallback(() => {
    refresh();
    persistKey(activeKeyRef.current, false);
  }, [refresh, persistKey]);

  /** 툴바 이미지 버튼 → 공유 파일 입력 → 활성 영역에 삽입. */
  const insertImagesIntoActive = React.useCallback(
    async (files: File[]) => {
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      const el = activeEditorRef.current;
      if (imgs.length === 0 || !el) return;
      el.focus();
      for (const f of imgs) {
        RT.insertImage(await imageToDataUrl(f));
      }
      persistKey(activeKeyRef.current, false);
    },
    [persistKey],
  );

  const saveAttachments = React.useCallback(
    (attachments: NoteAttachment[]) => {
      save(instanceId, { ...configRef.current, attachments, updatedAt: Date.now() });
    },
    [instanceId, save],
  );

  /** 섹션 배열 교체 저장 — 순수 연산이 no-op(같은 참조)이면 저장 생략. */
  const saveSections = React.useCallback(
    (mutate: (cur: NoteSection[]) => NoteSection[]) => {
      const cfg = configRef.current;
      const cur = cfg.sections ?? [];
      const next = mutate(cur);
      if (next === cur) return;
      save(instanceId, { ...cfg, sections: next, updatedAt: Date.now() });
    },
    [instanceId, save],
  );

  const addSection = () =>
    saveSections((cur) => [...cur, createSection(crypto.randomUUID())]);

  const saveSectionTitle = (id: string, title: string, debounce: boolean) => {
    const key = `title:${id}`;
    const timers = timersRef.current;
    const t = timers.get(key);
    if (t != null) {
      window.clearTimeout(t);
      timers.delete(key);
    }
    const run = () => {
      timers.delete(key);
      saveSections((cur) => updateSectionById(cur, id, { title, updatedAt: Date.now() }));
    };
    if (debounce) timers.set(key, window.setTimeout(run, 500));
    else run();
  };

  const sections = config.sections ?? [];
  const single = sectionId ? sections.find((s) => s.id === sectionId) ?? null : null;
  const hasSections = sections.length > 0;

  /** 섹션 헤더 한 줄: 소제목 입력 + 순서/삭제 컨트롤(단독 모드에선 입력만). */
  const sectionHeader = (s: NoteSection, i: number, solo: boolean) => (
    <div className="flex shrink-0 items-center gap-1">
      <input
        key={s.id}
        defaultValue={s.title}
        onChange={(e) => saveSectionTitle(s.id, e.target.value, true)}
        onBlur={(e) => saveSectionTitle(s.id, e.target.value, false)}
        placeholder="소제목 (예: 1주차, 7/3 일기)"
        data-pb-no-drag=""
        className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {solo ? null : deletingId === s.id ? (
        <>
          <button
            type="button"
            data-pb-no-drag=""
            onClick={() => {
              setDeletingId(null);
              saveSections((cur) => removeSectionById(cur, s.id));
            }}
            className="shrink-0 rounded-md bg-destructive px-2 py-1.5 text-xs font-medium text-destructive-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            삭제
          </button>
          <button
            type="button"
            data-pb-no-drag=""
            onClick={() => setDeletingId(null)}
            className="shrink-0 rounded-md border border-border px-2 py-1.5 text-xs text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            취소
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            title="위로"
            aria-label="소제목 위로 이동"
            disabled={i === 0}
            data-pb-no-drag=""
            onClick={() => saveSections((cur) => moveSectionById(cur, s.id, -1))}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            title="아래로"
            aria-label="소제목 아래로 이동"
            disabled={i === sections.length - 1}
            data-pb-no-drag=""
            onClick={() => saveSections((cur) => moveSectionById(cur, s.id, 1))}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30"
          >
            <ArrowDown size={14} />
          </button>
          <button
            type="button"
            title="소제목 삭제"
            aria-label="소제목 삭제"
            data-pb-no-drag=""
            onClick={() => setDeletingId(s.id)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 size={14} />
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-pb-no-drag="">
      <Toolbar
        editorRef={activeEditorRef}
        active={active}
        inTable={inTable}
        onAfter={onAfter}
        onPickImage={() => imageInputRef.current?.click()}
      />

      {single ? (
        // ── 단일 섹션 모드: 소제목 + 그 본문만(머리말·다른 섹션·첨부는 '전체 보기'로).
        <>
          {sectionHeader(single, sections.indexOf(single), true)}
          <RichTextArea
            key={single.id}
            editorKey={single.id}
            initialHtml={single.html}
            resetKey={`${instanceId}:${single.id}`}
            placeholder="이 소제목의 내용을 기록하세요…"
            fill
            ariaLabel={`소제목 '${single.title || "제목 없음"}' 본문`}
            registerEl={registerEl}
            onPersist={persistKey}
            onActivity={refresh}
          />
        </>
      ) : (
        // ── 전체 모드: 머리말 + 섹션 스택. 섹션이 없으면 기존 단일 본문 화면 그대로.
        <div
          className={
            hasSections
              ? "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-scroll pr-1"
              : "flex min-h-0 flex-1 flex-col"
          }
        >
          <RichTextArea
            editorKey={INTRO_KEY}
            initialHtml={config.html}
            resetKey={`${instanceId}:intro`}
            placeholder={
              hasSections
                ? "머리말(선택) — 이 노트 전체에 대한 설명…"
                : "여기에 강의 내용을 기록하세요… (붙여넣기·이미지·표·이미지 크기조절 지원)"
            }
            fill={!hasSections}
            // 머리말은 선택 영역 — 비어 있을 때 한 줄만 차지(요구), 쓰면 자라남.
            slim={hasSections}
            ariaLabel="노트 본문"
            registerEl={registerEl}
            onPersist={persistKey}
            onActivity={refresh}
          />

          {sections.map((s, i) => (
            <section key={s.id} className="flex shrink-0 flex-col gap-1.5">
              {sectionHeader(s, i, false)}
              <RichTextArea
                editorKey={s.id}
                initialHtml={s.html}
                resetKey={`${instanceId}:${s.id}`}
                placeholder="이 소제목의 내용을 기록하세요…"
                fill={false}
                ariaLabel={`소제목 '${s.title || "제목 없음"}' 본문`}
                registerEl={registerEl}
                onPersist={persistKey}
                onActivity={refresh}
              />
            </section>
          ))}

          {/* 소제목 추가 — 같은 분류(강의·일기 등)를 한 노트 안에 섹션으로 쌓는다. */}
          <button
            type="button"
            data-pb-no-drag=""
            onClick={addSection}
            className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border border-dashed border-primary/50 px-3 py-1.5 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={15} aria-hidden /> 소제목 추가
          </button>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void insertImagesIntoActive(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {single ? null : (
        <Attachments
          attachments={config.attachments}
          onChange={saveAttachments}
          onInsertImage={(dataUrl) => {
            const el = activeEditorRef.current;
            if (!el) return;
            el.focus();
            RT.insertImage(dataUrl);
            persistKey(activeKeyRef.current, false);
          }}
        />
      )}
    </div>
  );
}

export default NoteEditor;
