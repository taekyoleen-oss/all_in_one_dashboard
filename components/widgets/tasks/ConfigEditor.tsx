"use client";

/**
 * 작업 위젯 속성 — "모바일 홈 화면에 표시" 토글.
 *
 *  토글 UI·지정 규칙·즉시 영속은 주식·환율·노트와 공유한다(shared/MobileSyncToggle).
 *  여기서는 이 위젯이 폰에 무엇을 띄우는지만 문구로 설명한다.
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { MobileSyncToggle } from "@/components/widgets/shared/MobileSyncToggle";
import type { TasksConfig } from "./types";

export function TasksConfigEditor({
  config,
  onChange,
  instanceId,
}: ConfigEditorProps<TasksConfig>) {
  return (
    <MobileSyncToggle
      config={config}
      onChange={onChange}
      instanceId={instanceId}
      description={
        <>
          이 위젯의 작업 목록이 안드로이드 홈 화면 &lsquo;작업&rsquo; 위젯에 나타나고,
          양쪽 어디서 추가·삭제해도 서로 반영됩니다.
        </>
      }
      footnote={
        <>
          작업 데이터는 계정에 저장되어 모든 기기에서 같은 목록을 봅니다. 여러
          &lsquo;작업&rsquo; 위젯에서 이 옵션을 켜면 <b>마지막으로 켠 위젯</b>이 모바일에
          표시됩니다.
        </>
      }
    />
  );
}

export default TasksConfigEditor;
