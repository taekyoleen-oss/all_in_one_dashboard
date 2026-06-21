"use client";

/**
 * clipboard · ConfigEditor — capture toggle + history size.
 *
 *  Reports the whole next config via onChange (parent owns persistence). The
 *  history itself lives in localStorage per instance, so "전체 지우기" lives in the
 *  ExpandedView (which has the instanceId); here we only edit settings.
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { clampMaxItems, type ClipboardConfig } from "./types";

export function ClipboardConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<ClipboardConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          기록 설정
        </legend>

        <label className="flex items-center justify-between gap-2 text-sm text-foreground">
          <span>이 페이지의 복사 자동 기록</span>
          <input
            type="checkbox"
            checked={config.captureOnCopy !== false}
            onChange={(e) =>
              onChange({ ...config, captureOnCopy: e.target.checked })
            }
            className="size-4 accent-[var(--primary)]"
          />
        </label>

        <label className="flex items-center justify-between gap-2 text-sm text-foreground">
          <span>최대 보관 개수</span>
          <input
            type="number"
            min={5}
            max={200}
            value={config.maxItems}
            onChange={(e) =>
              onChange({ ...config, maxItems: clampMaxItems(Number(e.target.value)) })
            }
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </fieldset>

      <p className="text-[11px] text-muted-foreground">
        웹 앱은 보안상 윈도우 클립보드를 자동 감시할 수 없습니다. 이 페이지에서 복사한
        텍스트는 자동 기록되며, 다른 프로그램에서 복사한 내용은 위젯의 ‘클립보드에서
        추가’ 버튼이나 붙여넣기로 기록할 수 있어요. 기록은 이 기기에만 저장됩니다.
      </p>
    </div>
  );
}

export default ClipboardConfigEditor;
