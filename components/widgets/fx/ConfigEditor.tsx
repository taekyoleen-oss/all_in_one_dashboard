"use client";

/**
 * fx · ConfigEditor — pick the base currency + manage quote currencies (설계서 §2.2).
 *
 *  Controlled: reports the whole next config via onChange (the dialog owns the
 *  draft; the parent owns persistence). Two parts:
 *    1. 기준 통화 — the base every pair is quoted against (free text or a pick).
 *    2. 비교 통화 — the quote list, add/remove/reorder (the displayed pairs).
 *  Rate DATA never lives in config — only the base + quote selection does
 *  (live values arrive from /api/fx). Reorder uses up/down buttons so it is
 *  fully keyboard-operable (no drag dependency). Codes are upper-cased to match
 *  the server (ISO-4217); a duplicate / self-pair is rejected with a message.
 */

import * as React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import type { ConfigEditorProps } from "@/lib/widgets/contract";
import { COMMON_CURRENCIES, type FxConfig } from "./types";

const CODE_RE = /^[A-Za-z]{3}$/;

/** Look up a Korean label for a code (falls back to the bare code). */
function currencyLabel(code: string): string {
  return COMMON_CURRENCIES.find((c) => c.code === code)?.label ?? code;
}

export function FxConfigEditor({ config, onChange }: ConfigEditorProps<FxConfig>) {
  const [quoteInput, setQuoteInput] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const setBase = (raw: string) => {
    const base = raw.trim().toUpperCase();
    onChange({ ...config, base });
    // Drop a quote that now collides with the base (a base/base pair is meaningless).
    if (config.quotes.includes(base)) {
      onChange({ base, quotes: config.quotes.filter((q) => q !== base) });
    }
  };

  const setQuotes = (quotes: string[]) => onChange({ ...config, quotes });

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= config.quotes.length) return;
    const next = [...config.quotes];
    [next[index], next[target]] = [next[target], next[index]];
    setQuotes(next);
  };

  const remove = (code: string) =>
    setQuotes(config.quotes.filter((q) => q !== code));

  const add = (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!CODE_RE.test(code)) {
      setErr("3자리 통화 코드를 입력하세요 (예: KRW, EUR).");
      return;
    }
    if (code === config.base.toUpperCase()) {
      setErr("기준 통화와 동일한 통화는 추가할 수 없습니다.");
      return;
    }
    if (config.quotes.includes(code)) {
      setErr("이미 추가된 통화입니다.");
      return;
    }
    setQuotes([...config.quotes, code]);
    setQuoteInput("");
    setErr(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1) Base currency */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          기준 통화
        </legend>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          1 단위가 될 통화 (ISO-4217)
          <input
            list="pb-fx-base-list"
            value={config.base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="USD"
            maxLength={3}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm uppercase text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <datalist id="pb-fx-base-list">
            {COMMON_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </datalist>
        </label>
        <p className="text-[11px] text-muted-foreground">
          예: 기준 USD · 비교 KRW → “1 USD = … KRW”
        </p>
      </fieldset>

      {/* 2) Quote currencies */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          비교 통화
        </legend>

        <ul className="flex flex-col gap-1.5">
          {config.quotes.map((code, i) => (
            <li
              key={code}
              className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  {config.base}/{code}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {currencyLabel(code)}
                </span>
              </div>
              <button
                type="button"
                aria-label={`${code} 위로`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                aria-label={`${code} 아래로`}
                disabled={i === config.quotes.length - 1}
                onClick={() => move(i, 1)}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
              >
                <ArrowDown size={15} />
              </button>
              <button
                type="button"
                aria-label={`${code} 삭제`}
                onClick={() => remove(code)}
                className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {config.quotes.length === 0 ? (
            <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
              비교 통화가 없습니다.
            </li>
          ) : null}
        </ul>

        {/* Add a quote currency */}
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            통화 코드
            <input
              list="pb-fx-quote-list"
              value={quoteInput}
              onChange={(e) => setQuoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(quoteInput);
                }
              }}
              placeholder="KRW"
              maxLength={3}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm uppercase text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <datalist id="pb-fx-quote-list">
              {COMMON_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </datalist>
          </label>
          {err ? <p className="text-xs text-destructive">{err}</p> : null}
          <button
            type="button"
            onClick={() => add(quoteInput)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={15} aria-hidden />
            통화 추가
          </button>
        </div>
      </fieldset>
    </div>
  );
}

export default FxConfigEditor;
