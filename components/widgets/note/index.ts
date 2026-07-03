/**
 * note — WidgetDefinition (노트: 리치 텍스트 + 이미지 + 표 + 파일 첨부).
 *
 *  dataMode: 'static' (everything in config jsonb, no external API). copyBehavior:
 *  'config' (duplicate the note + its attachments). Primary use: 강의 내용 기록.
 */

import { NotebookPen } from "lucide-react";
import type { WidgetDefinition } from "@/lib/widgets/contract";
import { NoteCompactView } from "./CompactView";
import { NoteExpandedView } from "./ExpandedView";
import { NoteConfigEditor } from "./ConfigEditor";
import { DEFAULT_NOTE_CONFIG, type NoteConfig } from "./types";

export const noteWidget: WidgetDefinition<NoteConfig> = {
  type: "note",
  displayName: "노트",
  icon: NotebookPen,
  category: "extended",
  defaultConfig: DEFAULT_NOTE_CONFIG,
  defaultSize: { w: 8, h: 8 },
  // minSize.h=2: '제목만' 접기(TITLE_COLLAPSE_H=2)가 buildResponsiveLayout의
  // min 클램프에 되말리지 않도록 한 줄 높이까지 허용.
  minSize: { w: 4, h: 2 },
  maxSize: { w: 16, h: 20 },
  CompactView: NoteCompactView,
  ExpandedView: NoteExpandedView,
  ConfigEditor: NoteConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default noteWidget;
export type { NoteConfig, NoteSection } from "./types";
