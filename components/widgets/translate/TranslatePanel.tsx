"use client";

/**
 * translate · TranslatePanel — shared 번역기 UI (CompactView + ExpandedView).
 *
 *  Source/target language selectors with a swap button, an input textarea, a 번역
 *  button (Ctrl/⌘+Enter), and a result box with copy. Language choice persists to
 *  config (useSaveWidgetConfig); the input/result are local UI state. On swap,
 *  if source was "auto" it resolves to the detected language so the swap is sane.
 */

import * as React from "react";
import { ArrowLeftRight, Copy, Check, Languages } from "lucide-react";
import { useSaveWidgetConfig } from "@/lib/widgets/persistence";
import { useTranslate } from "./useTranslate";
import { LANGS, SOURCE_LANGS, langLabel } from "./langs";
import type { TranslateConfig } from "./types";

const selectCls =
  "min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TranslatePanel({
  config,
  instanceId,
  size = "compact",
}: {
  config: TranslateConfig;
  instanceId: string;
  size?: "compact" | "expanded";
}) {
  const save = useSaveWidgetConfig();
  const { result, loading, error, run } = useTranslate();
  const [text, setText] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const big = size === "expanded";

  const setLangs = (next: Partial<TranslateConfig>) =>
    save(instanceId, { ...config, ...next });

  const swap = () => {
    const detected = result?.detectedSource;
    const realSource = config.source === "auto" ? detected ?? "en" : config.source;
    setLangs({ source: config.target, target: realSource });
  };

  const doRun = () => run(text, config.source, config.target);

  const copy = async () => {
    if (!result?.translatedText) return;
    try {
      await navigator.clipboard.writeText(result.translatedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-2">
      {/* Language row */}
      <div className="flex shrink-0 items-center gap-1.5">
        <select
          value={config.source}
          onChange={(e) => setLangs({ source: e.target.value })}
          aria-label="원본 언어"
          className={`${selectCls} flex-1`}
        >
          {SOURCE_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={swap}
          aria-label="언어 바꾸기"
          title="언어 바꾸기"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftRight size={15} aria-hidden />
        </button>
        <select
          value={config.target}
          onChange={(e) => setLangs({ target: e.target.value })}
          aria-label="번역 언어"
          className={`${selectCls} flex-1`}
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* Input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            doRun();
          }
        }}
        placeholder="번역할 내용을 입력하세요"
        className={`w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          big ? "min-h-24" : "min-h-12 flex-1"
        }`}
      />

      <button
        type="button"
        onClick={doRun}
        disabled={loading || !text.trim()}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Languages size={15} aria-hidden />
        {loading ? "번역 중…" : "번역"}
      </button>

      {/* Result */}
      {error ? (
        <p className="shrink-0 text-xs text-destructive">{error}</p>
      ) : result ? (
        <div
          className={`relative flex min-h-0 flex-col rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 ${
            big ? "min-h-24" : "flex-1"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              {config.source === "auto" && result.detectedSource
                ? `${langLabel(result.detectedSource)} → ${langLabel(config.target)}`
                : `${langLabel(config.source)} → ${langLabel(config.target)}`}
            </span>
            <button
              type="button"
              onClick={copy}
              aria-label="번역 결과 복사"
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {copied ? <Check size={13} className="text-positive" /> : <Copy size={13} />}
            </button>
          </div>
          <p className="min-h-0 flex-1 overflow-y-auto pb-scroll whitespace-pre-wrap break-words text-sm text-foreground">
            {result.translatedText}
          </p>
          {result.note ? (
            <p className="text-[10px] text-muted-foreground">{result.note}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default TranslatePanel;
