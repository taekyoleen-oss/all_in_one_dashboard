"use client";

/**
 * useMemoRemoteSync — 폰에서 고친 메모를 웹 화면이 따라잡게 한다.
 *
 *  ── 왜 필요한가 ───────────────────────────────────────────────────────────
 *  메모 본문은 `pb_widgets.config`에 있는데, 이 표는 **realtime 발행 대상이 아니다**
 *  (pb_tasks·pb_clipboard만 발행한다 — 작업 위젯이 즉시 반영되는 이유가 그것이다).
 *  그래서 폰이 /api/widget/memos로 본문을 바꿔도 열려 있는 웹 화면은 알 길이 없고,
 *  그 상태로 웹에서 한 글자만 쳐도 **메모리에 든 옛 본문이 폰의 수정을 되덮는다.**
 *
 *  pb_widgets를 realtime에 넣는 방법은 택하지 않았다. 이 표는 캔버스 드래그마다
 *  갱신되고 config에는 이미지 슬라이드의 dataURL(메가바이트급)도 들어 있어,
 *  replica identity full로 전 행을 WAL에 실으면 대가가 기능에 비해 너무 크다.
 *
 *  ── 대신 하는 일 ─────────────────────────────────────────────────────────
 *  클립보드·작업 훅이 쓰는 **포커스 복귀 재조회**와 같은 방식이다. 창이 다시 포커스를
 *  얻으면 자기 행 하나(PK 조회)를 읽어 제목·본문이 서버에서 달라졌으면 로컬 config에
 *  반영한다. 폰에서 고치고 PC로 돌아오는 실제 흐름이 이 시점에 정확히 걸린다.
 *
 *  ⚠ 입력 중에는 건드리지 않는다 — 어딘가에 글을 쓰고 있으면(activeElement가 입력
 *    요소) 그 사람의 타이핑이 우선이고, 다음 포커스 때 다시 맞춘다.
 *  ⚠ 남는 틈: 웹·폰을 동시에 띄워 놓고 양쪽에서 같은 메모를 고치면 마지막 저장이
 *    이긴다. 이 구조(메모=위젯 config)의 한계이고, 없애려면 메모를 pb_tasks처럼
 *    전용 표로 옮겨야 한다.
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import type { MemoConfig } from "./types";

/** 지금 어딘가에 글을 쓰는 중인가(입력 중이면 동기화를 미룬다). */
function typing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "TEXTAREA" ||
    tag === "INPUT" ||
    (el as HTMLElement).isContentEditable === true
  );
}

export function useMemoRemoteSync(instanceId: string, config: MemoConfig): void {
  const save = useSaveWidgetConfig();

  // 최신 config를 ref로 — 리스너를 config가 바뀔 때마다 다시 붙이지 않는다.
  const configRef = React.useRef(config);
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);

  React.useEffect(() => {
    const supabase = createClient();
    let alive = true;

    const pull = async () => {
      if (typing()) return;
      const { data, error } = await supabase
        .from("pb_widgets")
        .select("config")
        .eq("id", instanceId)
        .maybeSingle();
      if (!alive || error || !data) return;
      // 읽어 오는 동안 사용자가 입력을 시작했을 수 있다 — 다시 확인한다.
      if (typing()) return;

      const remote = (data.config ?? {}) as Partial<MemoConfig>;
      const local = configRef.current;
      const title = typeof remote.title === "string" ? remote.title : undefined;
      const text = typeof remote.text === "string" ? remote.text : local.text;
      if (title === local.title && text === local.text) return;

      // 제목·본문만 가져온다 — 색·글자 크기 같은 기기별 편집 중 값은 로컬을 존중.
      save(instanceId, { ...local, ...(title !== undefined ? { title } : {}), text });
    };

    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [instanceId, save]);
}

export default useMemoRemoteSync;
