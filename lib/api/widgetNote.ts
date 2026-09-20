/**
 * ============================================================================
 *  노트 브리지 — 노트의 소제목(section) ↔ 폰 목록 사이의 순수 변환
 * ============================================================================
 *
 *  폰 목록의 한 줄 = 웹 '노트' 위젯 안의 **소제목 섹션 하나**다. 노트 위젯 하나가
 *  여러 소제목을 담으므로 노트 한 개로도 목록이 성립한다(메모 위젯을 쓰던 이전
 *  구조와 달리 위젯을 늘리지 않아도 된다).
 *
 *  ── 지켜야 하는 것 ───────────────────────────────────────────────────────
 *  섹션 본문은 **살균된 리치 HTML**이다(굵게·색·목록·표·이미지·첨부). 폰은 평문만
 *  다루므로 왕복시키면 서식이 사라진다. 그래서:
 *
 *  ① **이미지·표가 든 섹션은 폰에서 본문을 고칠 수 없다**(`rich`). 평문으로 덮어쓰면
 *     data URL 이미지와 표 구조가 **복구 불가능하게** 사라진다. 제목 수정과 삭제는
 *     된다(둘 다 사용자가 의도해서 누르는 동작이다).
 *  ② **본문 평문이 그대로면 HTML을 다시 쓰지 않는다.** 열어만 보거나 제목만 고친
 *     경우 원래 서식이 한 글자도 바뀌지 않는다 — 폰에서 여는 것만으로 굵게·색이
 *     풀리는 일을 막는다.
 *  ③ **config를 통째로 쓰지 않는다.** 머리말(html)·첨부·공유 대상 플래그·접기 상태
 *     같이 폰이 모르는 값은 그대로 두고 `sections` 배열만 교체한다.
 *
 *  ⚠ 남는 경합(설계상 한계): pb_widgets는 realtime 발행 대상이 아니라(pb_tasks·
 *    pb_clipboard만), 웹 화면이 열린 채 폰에서 고치면 웹의 디바운스 저장이 되덮을
 *    수 있다. 웹 쪽 완화는 `components/widgets/note/useNoteRemoteSync.ts`.
 */

import type { Json } from "@/output/types/database";
import type { WidgetNoteItem } from "@/output/api-shapes";

/** pb_widgets.config 한 덩어리 — 아는 키만 읽고 나머지는 그대로 보존한다. */
export type NoteConfigRow = { [key: string]: Json | undefined };

/** config.sections 한 칸(웹 NoteSection과 같은 모양). */
export interface NoteSectionRow {
  id: string;
  title: string;
  html: string;
  updatedAt?: number;
}

const str = (v: Json | undefined): string => (typeof v === "string" ? v : "");

/** config.sections를 안전하게 읽는다 — 형태가 깨진 항목은 버린다. */
export function sectionsOf(config: NoteConfigRow | null | undefined): NoteSectionRow[] {
  const raw = config?.sections;
  if (!Array.isArray(raw)) return [];
  const out: NoteSectionRow[] = [];
  for (const s of raw) {
    if (!s || typeof s !== "object" || Array.isArray(s)) continue;
    const o = s as { [k: string]: Json | undefined };
    const id = str(o.id);
    if (!id) continue;
    out.push({
      id,
      title: str(o.title),
      html: str(o.html),
      ...(typeof o.updatedAt === "number" ? { updatedAt: o.updatedAt } : {}),
    });
  }
  return out;
}

/**
 * 평문으로 되돌릴 수 없는 내용이 있는가(이미지·표·미디어).
 * 굵게·색·목록은 여기 넣지 않는다 — 글자는 남으므로 편집을 막을 만큼은 아니다.
 */
export function hasRichBlocks(html: string): boolean {
  return /<(img|table|iframe|video|audio)\b/i.test(html);
}

/**
 * 리치 HTML → 폰에서 읽고 쓸 평문. 블록 경계를 줄바꿈으로 살린다
 * (기존 sanitize.htmlToText는 미리보기용이라 공백을 전부 한 칸으로 접는다 —
 * 그건 줄 구조가 필요한 여기엔 맞지 않는다).
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    // 엔티티 복원 — &amp;를 마지막에 둬야 "&amp;lt;"가 "<"로 뭉개지지 않는다.
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 폰에서 쓴 평문 → 저장할 HTML(줄당 문단 하나). 값은 전부 이스케이프한다. */
export function plainTextToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines.every((l) => l.trim() === "")) return "";
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return lines
    .map((l) => (l.trim() === "" ? "<p><br></p>" : `<p>${esc(l)}</p>`))
    .join("");
}

/** 본문 첫 줄(최대 40자) — 소제목이 빈 섹션의 목록 표시용. */
function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

/** 노트 위젯 한 개 → 그 안의 소제목들을 폰 목록 항목으로. */
export function noteItems(
  noteId: string,
  config: NoteConfigRow | null | undefined,
  updatedAt: string,
): WidgetNoteItem[] {
  const noteTitle = str(config?.title).trim();
  return sectionsOf(config).map((s) => {
    const body = htmlToPlainText(s.html);
    return {
      noteId,
      sectionId: s.id,
      // 목록은 제목으로 고르는 화면이라 빈 줄을 두지 않는다.
      title: s.title.trim() || firstLine(body) || "제목 없음",
      body,
      rich: hasRichBlocks(s.html),
      noteTitle,
      updatedAt,
    };
  });
}

/** sections만 갈아 끼운 새 config — 머리말·첨부·플래그는 손대지 않는다(불변식 ③). */
function withSections(
  config: NoteConfigRow | null | undefined,
  sections: NoteSectionRow[],
): NoteConfigRow {
  return { ...(config ?? {}), sections: sections as unknown as Json };
}

/**
 * 소제목 하나를 고친 새 config. 없는 id면 null.
 * `text`가 주어져도 **평문이 같으면 html을 그대로 둔다**(불변식 ②).
 */
export function updateSection(
  config: NoteConfigRow | null | undefined,
  sectionId: string,
  patch: { title?: string; text?: string },
  now: number,
): NoteConfigRow | null {
  const sections = sectionsOf(config);
  const i = sections.findIndex((s) => s.id === sectionId);
  if (i < 0) return null;

  const cur = sections[i];
  const next: NoteSectionRow = { ...cur, updatedAt: now };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.text !== undefined && patch.text !== htmlToPlainText(cur.html)) {
    next.html = plainTextToHtml(patch.text);
  }
  const copy = sections.slice();
  copy[i] = next;
  return withSections(config, copy);
}

/**
 * 소제목을 **맨 위에** 넣은 새 config(요구: 새로 쓴 것이 목록 맨 위).
 * 배열 순서가 곧 웹 노트의 표시 순서라, 폰에서 추가한 소제목은 웹에서도 위에 온다.
 * 웹의 '＋ 소제목'(캐럿 기준 위/아래 삽입)은 별도 경로라 영향받지 않는다.
 */
export function prependSection(
  config: NoteConfigRow | null | undefined,
  sectionId: string,
  title: string,
  text: string,
  now: number,
): NoteConfigRow {
  const section: NoteSectionRow = {
    id: sectionId,
    title,
    html: plainTextToHtml(text),
    updatedAt: now,
  };
  return withSections(config, [section, ...sectionsOf(config)]);
}

/** 소제목을 지운 새 config. 없는 id면 null. */
export function deleteSection(
  config: NoteConfigRow | null | undefined,
  sectionId: string,
): NoteConfigRow | null {
  const sections = sectionsOf(config);
  const next = sections.filter((s) => s.id !== sectionId);
  if (next.length === sections.length) return null;
  return withSections(config, next);
}
