"use client";

/**
 * useTranslate — on-demand call to /api/translate (번역기).
 *
 *  Not a poll: exposes run(text, source, target) that fetches once and validates
 *  the response against TranslateSchema (types IMPORTED from output/api-shapes.ts,
 *  never re-declared). Tracks loading/error and the last result. An Abort
 *  controller cancels an in-flight request when a newer one starts.
 */

import * as React from "react";
import { TranslateSchema } from "@/output/api-shapes";

export type TranslateResult = typeof TranslateSchema._output;

export interface TranslateState {
  result: TranslateResult | null;
  loading: boolean;
  error: string | null;
  run: (text: string, source: string, target: string) => void;
  clear: () => void;
}

export function useTranslate(): TranslateState {
  const [result, setResult] = React.useState<TranslateResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const run = React.useCallback(
    (text: string, source: string, target: string) => {
      const q = text.trim();
      if (!q) {
        setError("번역할 내용을 입력하세요.");
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      const url = `/api/translate?q=${encodeURIComponent(
        text,
      )}&source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`;

      fetch(url, { signal: controller.signal, cache: "no-store" })
        .then(async (res) => {
          const json: unknown = await res.json();
          if (!res.ok) {
            setError("번역에 실패했습니다. 잠시 후 다시 시도하세요.");
            return;
          }
          const parsed = TranslateSchema.safeParse(json);
          if (!parsed.success) {
            setError("번역 응답을 처리하지 못했습니다.");
            return;
          }
          setResult(parsed.data);
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError("네트워크 오류가 발생했습니다.");
        })
        .finally(() => {
          if (abortRef.current === controller) setLoading(false);
        });
    },
    [],
  );

  const clear = React.useCallback(() => {
    abortRef.current?.abort();
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  return { result, loading, error, run, clear };
}

export default useTranslate;
