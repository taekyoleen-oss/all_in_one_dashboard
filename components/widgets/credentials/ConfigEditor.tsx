"use client";

/**
 * credentials · ConfigEditor — only NON-sensitive settings (설계서 §9.4).
 *
 *  The vault itself (사이트·아이디·비밀번호·비고) is encrypted in localStorage and
 *  managed from the tile/expanded view — it never appears here, because `config`
 *  round-trips to Supabase. The only knob is the auto-relock timeout.
 */

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import type { CredentialsConfig } from "./types";

const LOCK_OPTIONS = [1, 3, 5, 10, 30, 60];

export function CredentialsConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<CredentialsConfig>) {
  const lockAfterMin = config.lockAfterMin || 5;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          자동 잠금
        </legend>
        <label className="flex items-center justify-between gap-3 text-sm text-foreground">
          <span>잠금 해제 후 이 시간이 지나면 자동으로 잠금</span>
          <select
            value={lockAfterMin}
            onChange={(e) =>
              onChange({ ...config, lockAfterMin: Number(e.target.value) })
            }
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {LOCK_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}분
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] text-muted-foreground">
          잠금 해제 후 이 시간이 지나면 사용 중이어도 다시 마스터 비밀번호를
          물어봅니다. 앱을 새로 실행해도 다시 잠깁니다.
        </p>
      </fieldset>

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
        <ShieldCheck
          size={16}
          aria-hidden
          className="mt-0.5 shrink-0 text-emerald-500"
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          저장한 로그인 정보는 마스터 비밀번호로 <b>암호화(AES-GCM)</b>되어 이
          기기에만 보관됩니다. 서버·클라우드로 전송되지 않으며 다른 기기와
          동기화되지 않습니다. 마스터 비밀번호는 복구할 수 없으니 잊지 마세요.
          금고 설정·잠금·초기화는 위젯 타일에서 합니다.
        </p>
      </div>
    </div>
  );
}

export default CredentialsConfigEditor;
