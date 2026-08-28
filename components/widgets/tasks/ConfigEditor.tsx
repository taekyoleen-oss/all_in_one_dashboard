"use client";

/**
 * 작업 위젯 속성 — "모바일 홈 화면에 표시" 토글.
 *
 *  켜면 이 인스턴스의 목록이 안드로이드 홈 화면 '작업' 위젯에 나타난다. 지정은
 *  config 플래그(mobileSync + 켠 시각 mobileSyncAt)만으로 서버가 해석한다 —
 *  여러 위젯에서 켜져 있으면 **마지막으로 켠 위젯**이 표시된다(교차 인스턴스
 *  해제 배선 없이 단일 지정을 달성, 안내 문구로 명시).
 *
 *  토글은 메모 비밀번호 선례대로 **즉시 영속**(useSaveWidgetConfig) — '저장' 없이
 *  닫아도 유지돼 "체크했는데 모바일에 안 나온다" 혼란을 막는다.
 */

import * as React from "react";
import { Smartphone } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import type { TasksConfig } from "./types";

export function TasksConfigEditor({
  config,
  onChange,
  instanceId,
}: ConfigEditorProps<TasksConfig>) {
  const save = useSaveWidgetConfig();
  const on = Boolean(config.mobileSync);

  const toggle = () => {
    const next: TasksConfig = on
      ? { ...config, mobileSync: false, mobileSyncAt: undefined }
      : { ...config, mobileSync: true, mobileSyncAt: Date.now() };
    onChange(next); // 다이얼로그 draft 동기화
    if (instanceId) save(instanceId, next); // 즉시 영속
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          className="flex items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2">
            <Smartphone size={15} aria-hidden className="shrink-0 text-primary" />
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                모바일 홈 화면에 표시
              </span>
              <span className="text-[11px] text-muted-foreground">
                이 위젯의 작업 목록이 안드로이드 홈 화면 &lsquo;작업&rsquo; 위젯에
                나타나고, 양쪽 어디서 추가·삭제해도 서로 반영됩니다.
              </span>
            </span>
          </span>
          <span
            aria-hidden
            className={[
              "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
              on ? "bg-primary" : "bg-border",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-0.5 size-4 rounded-full bg-white transition-transform",
                on ? "translate-x-[18px]" : "translate-x-0.5",
              ].join(" ")}
            />
          </span>
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        작업 데이터는 계정에 저장되어 모든 기기에서 같은 목록을 봅니다. 여러
        &lsquo;작업&rsquo; 위젯에서 이 옵션을 켜면 <b>마지막으로 켠 위젯</b>이 모바일에
        표시됩니다.
      </p>
    </div>
  );
}

export default TasksConfigEditor;
