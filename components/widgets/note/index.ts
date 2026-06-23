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
  minSize: { w: 4, h: 3 },
  maxSize: { w: 16, h: 20 },
  CompactView: NoteCompactView,
  ExpandedView: NoteExpandedView,
  ConfigEditor: NoteConfigEditor,
  copyBehavior: "config",
  dataMode: "static",
};

export default noteWidget;
export type { NoteConfig } from "./types";
