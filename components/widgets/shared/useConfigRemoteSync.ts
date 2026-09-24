"use client";

/**
 * useConfigRemoteSync — 폰(홈 화면 위젯)에서 고친 config를 웹이 따라잡게 한다.
 *
 *  ── 왜 필요한가 ───────────────────────────────────────────────────────────
 *  노트 소제목·주식 종목·환율 통화는 모두 `pb_widgets.config` 안에 있는데, 이 표는
 *  **realtime 발행 대상이 아니다**(pb_tasks·pb_clipboard만 발행한다 — 작업 위젯이
 *  즉시 반영되는 이유가 그것이다). 그래서 폰이 /api/widget/*로 항목을 더하거나 지워도
 *  열려 있는 웹 화면은 알 수 없고, 그 상태로 위젯을 조금만 건드려도 **메모리에 든
 *  옛 config가 폰의 변경을 되덮는다.**
 *
 *  pb_widgets를 realtime에 넣는 방법은 택하지 않았다. 이 표는 캔버스 드래그마다
 *  갱신되고 config에는 이미지 슬라이드의 dataURL(메가바이트급)도 들어 있어,
 *  replica identity full로 전 행을 WAL에 실으면 대가가 기능에 비해 너무 크다.
 *
 *  ── 대신 하는 일 ─────────────────────────────────────────────────────────
 *  클립보드·작업 훅이 쓰는 **포커스 복귀 재조회**와 같다. 창이 다시 포커스를 얻으면
 *  자기 행 하나(PK 조회)를 읽어 `fields`가 서버에서 달라졌으면 로컬 config에
 *  반영한다. 폰에서 고치고 PC로 돌아오는 실제 흐름이 이 시점에 정확히 걸린다.
 *
 *  ⚠ 입력 중에는 건드리지 않는다(노트 편집기는 contentEditable이라 그것까지 확인).
 *  ⚠ 남는 틈: 웹·폰을 동시에 열어 두고 같은 위젯을 함께 고치면 마지막 저장이 이긴다.
 *    이 구조(항목 = 위젯 config 안의 배열)의 한계다.
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";

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

/**
 * `fields`에 적은 키만 서버 값과 비교해 반영한다 — 나머지(웹에서만 바뀌는 색·크기
 * 등)는 폰이 건드리지 않으므로 볼 이유가 없다.
 */
export function useConfigRemoteSync<T extends object>(
  instanceId: string,
  config: T,
  fields: (keyof T)[],
): void {
  const save = useSaveWidgetConfig();

  // 최신 config를 ref로 — 리스너를 config가 바뀔 때마다 다시 붙이지 않는다.
  const configRef = React.useRef(config);
  React.useEffect(() => {
    configRef.current = config;
  }, [config]);

  // 키 배열도 렌더마다 새 배열로 오므로 내용으로 고정한다(리스너 재부착 방지).
  const keys = fields.join(",");

  React.useEffect(() => {
    const supabase = createClient();
    const names = keys.split(",").filter(Boolean) as (keyof T)[];
    let alive = true;

    const pull = async () => {
      if (typing()) return;
      const { data, error } = await supabase
        .from("pb_widgets")
        .select("config")
        .eq("id", instanceId)
        .maybeSingle();
      if (!alive || error || !data) return;
      // 읽어 오는 동안 편집을 시작했을 수 있다 — 다시 확인한다.
      if (typing()) return;

      const remote = (data.config ?? {}) as Partial<T>;
      const local = configRef.current;
      const changed: Partial<T> = {};
      for (const key of names) {
        if (!(key in remote)) continue;
        if (JSON.stringify(remote[key]) === JSON.stringify(local[key])) continue;
        changed[key] = remote[key];
      }
      if (Object.keys(changed).length === 0) return;
      save(instanceId, { ...local, ...changed });
    };

    const onFocus = () => void pull();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [instanceId, keys, save]);
}

export default useConfigRemoteSync;
