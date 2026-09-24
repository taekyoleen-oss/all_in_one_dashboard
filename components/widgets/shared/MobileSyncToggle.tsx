"use client";

/**
 * "모바일 홈 화면에 표시" 토글 — 작업·노트·주식·환율 위젯 속성이 함께 쓴다.
 *
 *  지정은 config 플래그(mobileSync + 켠 시각 mobileSyncAt)만으로 서버가 해석한다
 *  (lib/api/widgetCore.ts). 여러 인스턴스에서 켜져 있으면 **마지막으로 켠 위젯**이
 *  폰에 표시된다 — 교차 인스턴스 해제 배선 없이 단일 지정이 성립하고, 아래 안내
 *  문구가 그 규칙을 그대로 알린다.
 *
 *  토글은 메모 비밀번호 선례대로 **즉시 영속**(useSaveWidgetConfig) — '저장' 없이
 *  닫아도 유지돼 "켰는데 폰에 안 나온다" 혼란을 막는다.
 */

import * as React from "react";
import { Smartphone } from "lucide-react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";

/** mobileSync 플래그를 갖는 위젯 config의 공통 부분. */
export interface MobileSyncConfig {
  mobileSync?: boolean;
  mobileSyncAt?: number;
}

export interface MobileSyncToggleProps<T extends MobileSyncConfig> {
  config: T;
  onChange: (next: T) => void;
  /** 없으면(미리보기 등) 즉시 영속만 건너뛴다. */
  instanceId?: string;
  /** 토글 아래 한 줄 설명 — 위젯마다 무엇이 폰에 나타나는지. */
  description: React.ReactNode;
  /** 블록 아래 보조 안내(선택). */
  footnote?: React.ReactNode;
}

export function MobileSyncToggle<T extends MobileSyncConfig>({
  config,
  onChange,
  instanceId,
  description,
  footnote,
}: MobileSyncToggleProps<T>) {
  const save = useSaveWidgetConfig();
  const on = Boolean(config.mobileSync);

  const toggle = () => {
    const next: T = on
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
              <span className="text-[11px] text-muted-foreground">{description}</span>
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
      {footnote ? (
        <p className="text-[11px] text-muted-foreground">{footnote}</p>
      ) : null}
    </div>
  );
}

export default MobileSyncToggle;
