"use client";

/**
 * essential-info · ConfigEditor — 메모장(비번설정) 설정: password + auto-relock.
 *
 *  The note body is edited inline on the tile/expanded view; here you set or clear
 *  the unlock password (stored as a SHA-256 hash, never plaintext) and the
 *  inactivity timeout after which it re-locks.
 */

import * as React from "react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { hashPassword, type EssentialInfoConfig } from "./types";

const TIMEOUTS = [1, 3, 5, 10, 30, 60];

export function EssentialInfoConfigEditor({
  config,
  onChange,
}: ConfigEditorProps<EssentialInfoConfig>) {
  const [pw, setPw] = React.useState("");
  const [notice, setNotice] = React.useState<string | null>(null);
  const hasLock = !!config.pwHash;

  const applyPassword = async () => {
    const hash = await hashPassword(pw);
    onChange({ ...config, pwHash: hash });
    setPw("");
    setNotice(hash ? "비밀번호가 설정되었습니다." : "비밀번호가 해제되었습니다.");
  };

  const clearPassword = () => {
    onChange({ ...config, pwHash: null });
    setPw("");
    setNotice("비밀번호가 해제되었습니다.");
  };

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          비밀번호 잠금
        </legend>
        <p className="text-[11px] text-muted-foreground">
          현재 상태: {hasLock ? "🔒 잠금 설정됨" : "🔓 잠금 없음"} — 내용은
          타일에서 바로 입력/수정합니다.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setNotice(null);
          }}
          autoComplete="new-password"
          placeholder={hasLock ? "새 비밀번호(비우면 해제)" : "비밀번호 설정"}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void applyPassword()}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            {pw.trim() ? "비밀번호 적용" : "변경 사항 적용"}
          </button>
          {hasLock ? (
            <button
              type="button"
              onClick={clearPassword}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              잠금 해제
            </button>
          ) : null}
        </div>
        {notice ? (
          <p className="text-[11px] text-muted-foreground">{notice}</p>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          자동 잠금 시간
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {TIMEOUTS.map((m) => {
            const active = (config.lockAfterMin || 5) === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...config, lockAfterMin: m })}
                className={[
                  "rounded-md border px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-foreground hover:bg-accent/40",
                ].join(" ")}
              >
                {m}분
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          잠금 해제 후 이 시간이 지나면 사용 중이어도 자동으로 다시 잠깁니다(비밀번호 설정 시).
        </p>
      </fieldset>

      <p className="text-[11px] text-muted-foreground">
        ⚠ 주민등록번호·카드번호 전체·계좌 비밀번호 등 민감정보는 저장하지 마세요.
        비밀번호는 해시로만 저장되어 분실 시 복구할 수 없습니다.
      </p>
    </div>
  );
}

export default EssentialInfoConfigEditor;
