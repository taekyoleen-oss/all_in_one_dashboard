"use client";

/**
 * ============================================================================
 *  WidgetPip — 위젯을 OS 항상-위(always-on-top) 창에 고정 (Document PiP)
 * ============================================================================
 *
 *  Chrome/Edge의 Document Picture-in-Picture API로 위젯의 ExpandedView를
 *  브라우저 밖 최상위 창에 렌더한다. 이 창은 OS 레벨이라 다른 앱/프로그램 위에
 *  항상 떠 있고, 이동·크기조절은 창 자체가 네이티브로 지원한다. 내용이 창보다
 *  길면 내부 스크롤로 본다.
 *
 *  구조:
 *   • openWidgetPipWindow() — 사용자 제스처 안에서 호출(전체보기의 고정 버튼).
 *     작은 창(420×560)으로 열고, 본문 스타일시트·루트 속성(data-theme 등)을
 *     PiP 문서로 복사한다(Tailwind 토큰이 :root[data-theme]에 키됨).
 *   • <WidgetPipPortal> — CanvasShell 트리 안에서 createPortal로 PiP 문서
 *     body에 렌더 → React 컨텍스트(WidgetPersistenceProvider 등)가 그대로
 *     흘러 위젯 내 편집/저장도 동작한다.
 *
 *  수명: 사용자가 PiP 창을 닫으면 pagehide → onClosed로 상태 정리. 고정된
 *  위젯이 삭제되면 창을 닫는다. 브라우저 정책상 문서 PiP 창은 1개만 허용 —
 *  다른 위젯을 고정하면 기존 창을 먼저 닫는다.
 *
 *  미지원 브라우저(Firefox/Safari)는 isDocumentPipSupported()로 감지해
 *  호출부가 토스트로 안내한다.
 * ============================================================================
 */

import * as React from "react";
import { createPortal } from "react-dom";
import type { WidgetRegistry } from "@/lib/widgets/contract";
import type { WidgetInstance } from "@/components/canvas/GridCanvas";
import { FocusCloseProvider } from "@/lib/widgets/persistence";

interface DocumentPipOptions {
  width?: number;
  height?: number;
  disallowReturnToOpener?: boolean;
}

interface DocumentPipApi {
  requestWindow(options?: DocumentPipOptions): Promise<Window>;
  readonly window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPipApi;
  }
}

/** 문서 PiP 지원 여부 (Chromium 계열 + secure context). */
export function isDocumentPipSupported(): boolean {
  return typeof window !== "undefined" && !!window.documentPictureInPicture;
}

/** 기본 창 크기 — "적절히 작게" 열어 이동·크기조절 여지를 남긴다(사용자 조절 가능). */
const PIP_DEFAULT_W = 420;
const PIP_DEFAULT_H = 560;

/**
 * PiP 창을 연다. 반드시 사용자 제스처(클릭) 콜스택 안에서 호출해야 한다.
 * 실패(미지원 포함)는 throw — 호출부가 토스트로 안내.
 */
export async function openWidgetPipWindow(): Promise<Window> {
  const api = window.documentPictureInPicture;
  if (!api) throw new Error("document-pip-unsupported");
  // 브라우저는 문서 PiP 창을 1개만 허용 — 기존 창이 있으면 먼저 닫는다.
  api.window?.close();
  const pip = await api.requestWindow({
    width: PIP_DEFAULT_W,
    height: PIP_DEFAULT_H,
  });
  adoptDocumentChrome(pip);
  return pip;
}

/**
 * 메인 문서의 스타일·루트 속성을 PiP 문서로 복사한다.
 *  - 스타일시트: cssRules를 <style>로 인라인(same-origin), 접근 불가 시트는
 *    href로 <link> 재참조. next/font의 @font-face도 CSSOM 직렬화로 절대 URL이
 *    되어 그대로 동작한다.
 *  - 루트 속성: 폰트 변수 클래스, data-theme(다크/라이트 토큰), data-updown.
 */
function adoptDocumentChrome(pip: Window) {
  const doc = pip.document;
  const srcRoot = document.documentElement;
  doc.documentElement.setAttribute("lang", srcRoot.getAttribute("lang") ?? "ko");
  doc.documentElement.className = srcRoot.className;
  for (const name of ["data-theme", "data-updown"] as const) {
    const v = srcRoot.getAttribute(name);
    if (v != null) doc.documentElement.setAttribute(name, v);
  }
  doc.body.className = document.body.className;
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      const style = doc.createElement("style");
      style.textContent = css;
      doc.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = doc.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        doc.head.appendChild(link);
      }
    }
  }
}

/** 컴포넌트 밖 DOM 변이 헬퍼 — react-hooks 불변성 규칙(prop 변이 금지) 준수. */
function setPipDocumentTitle(win: Window, title: string) {
  win.document.title = title;
}

export interface WidgetPipPortalProps {
  registry: WidgetRegistry;
  /** 고정된 인스턴스 — 삭제 등으로 사라지면 null → 창을 닫는다. */
  instance: WidgetInstance | null;
  pipWindow: Window;
  /** 메인 앱의 테마 — 토글 시 PiP 문서에도 반영. */
  theme: "dark" | "light";
  /** 창이 닫혔을 때(사용자 X·브라우저·close()) 상태 정리. */
  onClosed: () => void;
}

export function WidgetPipPortal({
  registry,
  instance,
  pipWindow,
  theme,
  onClosed,
}: WidgetPipPortalProps) {
  // 창 닫힘 감지 — 문서 PiP의 표준 신호는 pagehide.
  React.useEffect(() => {
    const handle = () => onClosed();
    pipWindow.addEventListener("pagehide", handle);
    return () => pipWindow.removeEventListener("pagehide", handle);
  }, [pipWindow, onClosed]);

  // 테마 토글을 PiP 문서에 동기화(토큰이 :root[data-theme]에 키됨).
  React.useEffect(() => {
    pipWindow.document.documentElement.setAttribute("data-theme", theme);
  }, [pipWindow, theme]);

  // 고정 대상이 사라지면(위젯 삭제) 창을 닫는다 → pagehide → onClosed.
  React.useEffect(() => {
    if (!instance) pipWindow.close();
  }, [instance, pipWindow]);

  const def = instance ? registry[instance.type] : undefined;
  const title =
    (instance && def?.instanceTitle ? def.instanceTitle(instance.config) : null) ||
    def?.displayName ||
    instance?.type ||
    "";

  // PiP 창 타이틀바에 위젯 이름 표시.
  React.useEffect(() => {
    if (title) setPipDocumentTitle(pipWindow, title);
  }, [pipWindow, title]);

  if (!instance || !def) return null;

  return createPortal(
    // h-dvh + 내부 overflow-auto: 헤더는 고정, 내용은 창 스크롤로 조절(요구).
    <div className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        {typeof def.icon !== "string" && def.icon ? (
          <span className="flex size-4 items-center justify-center text-muted-foreground">
            {React.createElement(def.icon, { size: 14 })}
          </span>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
      </header>
      <div className="@container/focus min-h-0 flex-1 overflow-auto p-3">
        <div className="mx-auto h-full w-full">
          {/* 위젯 내부의 '오버레이 닫기' 어포던스(예: 노트 제목만 접기)는 PiP
              창 닫기로 매핑 — 전체보기와 같은 의미(접기 + 화면에서 치우기). */}
          <FocusCloseProvider onClose={() => pipWindow.close()}>
            <def.ExpandedView
              key={instance.instanceId}
              config={instance.config}
              instanceId={instance.instanceId}
            />
          </FocusCloseProvider>
        </div>
      </div>
    </div>,
    pipWindow.document.body,
  );
}

export default WidgetPipPortal;
