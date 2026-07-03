/**
 * note · prose — 에디터와 읽기 전용 미리보기가 공유하는 본문 스타일.
 *
 *  NoteEditor에 있던 것을 분리 — RichTextArea(에디터)와 CompactView(미리보기)가
 *  NoteEditor를 거치지 않고 import할 수 있어 순환 의존이 생기지 않는다.
 */

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
