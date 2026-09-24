"use client";

/**
 * stock · ConfigEditor — 폰 위젯 연동 + 지수·종목 선택 (설계서 §2.1).
 *
 *  종목 선택은 SymbolManager에 위임하고, 맨 위에 "모바일 홈 화면에 표시" 토글을 둔다
 *  (작업·노트와 같은 지정 규칙 — shared/MobileSyncToggle). 폰 쪽은 **보기 전용**이라
 *  종목을 더하고 빼는 일은 여기서만 한다.
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { MobileSyncToggle } from "@/components/widgets/shared/MobileSyncToggle";
import { SymbolManager } from "./SymbolManager";
import type { StockConfig } from "./types";

export function StockConfigEditor({
  config,
  onChange,
  instanceId,
}: ConfigEditorProps<StockConfig>) {
  return (
    <div className="flex flex-col gap-4">
      <MobileSyncToggle
        config={config}
        onChange={onChange}
        instanceId={instanceId}
        description={
          <>
            이 위젯의 종목 시세가 안드로이드 홈 화면 &lsquo;주식&rsquo; 위젯에 같은
            순서로 표시됩니다(보기 전용 — 종목 추가·삭제는 여기서). 시간외 거래 중이면
            PRE·시간외 표식이 함께 나옵니다.
          </>
        }
        footnote={
          <>
            여러 &lsquo;주식&rsquo; 위젯에서 켜면 <b>마지막으로 켠 위젯</b>이 폰에
            표시됩니다. 주식 위젯이 하나뿐이면 켜지 않아도 그 위젯이 표시됩니다.
          </>
        }
      />
      <SymbolManager config={config} onChange={onChange} />
    </div>
  );
}

export default StockConfigEditor;
