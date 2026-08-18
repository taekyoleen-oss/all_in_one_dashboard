/**
 * memo — WidgetDefinition (설계서 §2.1 #2). copyBehavior: 'content' (copies the
 * memo body). Config-driven: every view renders from `config`, so editing config
 * re-renders the tile.
 */

import { NotebookPen } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { MemoCompactView } from "./CompactView";
import { MemoExpandedView } from "./ExpandedView";
import { MemoConfigEditor } from "./ConfigEditor";
import {
  DEFAULT_MEMO_CONFIG,
  memoInstanceTitle,
  type MemoConfig,
} from "./types";

export const memoWidget: WidgetDefinition<MemoConfig> = {
  type: "memo",
  displayName: "메모",
  icon: NotebookPen,
  category: "core",
  defaultConfig: DEFAULT_MEMO_CONFIG,
  defaultSize: { w: 6, h: 4 },
  minSize: { w: 4, h: 2 },
  maxSize: { w: 16, h: 12 },
  CompactView: MemoCompactView,
  ExpandedView: MemoExpandedView,
  ConfigEditor: MemoConfigEditor,
  // 헤더 제목 = 본문 상단 제목(config.title). 헤더 더블클릭 변경도 같은 필드에
  // 저장되므로 본문 제목이 함께 바뀐다(양방향).
  instanceTitle: memoInstanceTitle,
  renameInstance: (config, title) => ({ ...config, title: title.trim() }),
  // 제목은 한 번만 보이게: 타일은 프레임 헤더가, 전체보기는 본문 입력란이 담당
  // (이 플래그가 전체보기 헤더의 제목 텍스트를 숨긴다).
  titleInBody: true,
  copyBehavior: "content",
  dataMode: "static",
  // 내용 편집은 전체보기(편집 가능 textarea)에서 — 메뉴 '편집'이 전체보기를 열고,
  // ConfigEditor(색상·글자·비밀번호)는 '스타일 편집'으로 노출된다.
  editInFocus: true,
};

export default memoWidget;
export type { MemoConfig } from "./types";
