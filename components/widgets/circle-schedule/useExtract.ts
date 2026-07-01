"use client";

/**
 * useExtract — 카카오톡 텍스트를 서버(/api/circle-schedule/extract)로 보내 약속
 * 후보를 받아오는 훅. useTranslate와 동일한 패턴(로딩/오류/중단 처리 + 응답을
 * 공유 스키마 ExtractSchema로 방어적 검증).
 */

import * as React from "react";
import { ExtractSchema, type ExtractedAppointment } from "@/output/api-shapes";

export interface ExtractState {
  result: ExtractedAppointment[] | null;
  loading: boolean;
  error: string | null;
  /** 텍스트를 추출 요청. */
  run: (text: string) => void;
  /** 결과·오류를 비운다(저장 완료/취소 후). */
  clear: () => void;
}

export function useExtract(): ExtractState {
  const [result, setResult] = React.useState<ExtractedAppointment[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const clear = React.useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  const run = React.useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("정리할 내용을 붙여넣어 주세요.");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);

    fetch("/api/circle-schedule/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const msg =
            (json as { message?: string } | null)?.message ??
            "정리에 실패했습니다. 잠시 후 다시 시도해 주세요.";
          setError(msg);
          return;
        }
        const parsed = ExtractSchema.safeParse(json);
        if (!parsed.success) {
          setError("결과를 처리하지 못했습니다. 다시 시도해 주세요.");
          return;
        }
        setResult(parsed.data.appointments);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("네트워크 오류가 발생했습니다.");
      })
      .finally(() => {
        if (abortRef.current === controller) setLoading(false);
      });
  }, []);

  return { result, loading, error, run, clear };
}

export default useExtract;
