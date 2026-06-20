"use client";

/**
 * stock · SymbolManager — toggle indices + add/remove 국내 개별 종목 (설계서 §2.1).
 *
 *  Controlled: reports the whole next config via onChange (the ConfigEditor wires
 *  this to the dialog draft; the parent owns persistence). Two sections:
 *    1. 지수 — checkbox toggles for the curated indices (코스피·코스닥·다우·S&P·나스닥).
 *    2. 국내 종목 — add by 6-digit code (or pick a suggestion), remove with reorder.
 *  US individual stocks are intentionally not offered (미국은 지수만).
 */

import * as React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import {
  INDEX_CATALOG,
  searchKrStocks,
  isIndexSymbol,
  krCode,
  resolveMeta,
} from "@/lib/api/stock/symbols";
import type { StockConfig } from "./types";

export function SymbolManager({
  config,
  onChange,
}: {
  config: StockConfig;
  onChange: (next: StockConfig) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);

  const setSymbols = (symbols: string[]) => onChange({ ...config, symbols });

  const has = (sym: string) => config.symbols.includes(sym);

  // Catalog search results for the current query (회사명 부분일치 또는 코드 접두).
  const results = searchKrStocks(query);
  const isBareCode = /^\d{6}(\.[A-Za-z]{2})?$/.test(query.trim());

  /** Add an exact catalog symbol (from a clicked search result). */
  const addSymbol = (sym: string) => {
    if (has(sym)) {
      setErr("이미 추가된 종목입니다.");
      return;
    }
    setSymbols([...config.symbols, sym]);
    setQuery("");
    setErr(null);
  };

  const toggleIndex = (sym: string) => {
    if (has(sym)) {
      setSymbols(config.symbols.filter((s) => s !== sym));
    } else {
      setSymbols([...config.symbols, sym]);
    }
  };

  // Individual KR stocks currently in the list (preserve order).
  const stockSymbols = config.symbols.filter((s) => !isIndexSymbol(s));

  const removeStock = (sym: string) =>
    setSymbols(config.symbols.filter((s) => s !== sym));

  const moveStock = (sym: string, dir: -1 | 1) => {
    const idx = config.symbols.indexOf(sym);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= config.symbols.length) return;
    const next = [...config.symbols];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSymbols(next);
  };

  const addStock = (raw: string) => {
    const s = raw.trim();
    const code = krCode(s);
    if (!code && !/^\d{6}(\.[A-Za-z]{2})?$/.test(s)) {
      setErr("6자리 국내 종목코드를 입력하세요 (예: 005930, 035720.KQ).");
      return;
    }
    const symbol = s;
    if (has(symbol)) {
      setErr("이미 추가된 종목입니다.");
      return;
    }
    setSymbols([...config.symbols, symbol]);
    setQuery("");
    setErr(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1) Indices */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          지수
        </legend>
        <div className="grid grid-cols-2 gap-1.5">
          {INDEX_CATALOG.map((m) => (
            <label
              key={m.symbol}
              className="flex items-center gap-2 text-sm text-foreground"
            >
              <input
                type="checkbox"
                checked={has(m.symbol)}
                onChange={() => toggleIndex(m.symbol)}
                className="size-4 accent-[var(--primary)]"
              />
              <span className="truncate">
                {m.name}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  {m.currency === "USD" ? "US" : "KR"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 2) Individual KR stocks */}
      <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-xs font-medium text-muted-foreground">
          국내 개별 종목
        </legend>

        <ul className="flex flex-col gap-1.5">
          {stockSymbols.map((sym) => {
            const meta = resolveMeta(sym);
            return (
              <li
                key={sym}
                className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {meta.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {sym}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`${meta.name} 위로`}
                  onClick={() => moveStock(sym, -1)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`${meta.name} 아래로`}
                  onClick={() => moveStock(sym, 1)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`${meta.name} 삭제`}
                  onClick={() => removeStock(sym)}
                  className="inline-flex size-7 items-center justify-center rounded-md text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
          {stockSymbols.length === 0 ? (
            <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
              추가된 국내 종목이 없습니다.
            </li>
          ) : null}
        </ul>

        {/* Add by SEARCH — type a company name or code, then pick a result. */}
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            종목 검색 (회사명 또는 코드)
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setErr(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  // Enter adds the top result, else tries the raw text as a code.
                  if (results.length > 0) addSymbol(results[0].symbol);
                  else addStock(query);
                }
              }}
              placeholder="삼성, 005930, 카카오…"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {err ? <p className="text-xs text-destructive">{err}</p> : null}

          {/* Results (click to add). Falls back to a direct 6-digit code add. */}
          <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto pb-scroll">
            {results.map((m) => {
              const added = has(m.symbol);
              return (
                <li key={m.symbol}>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => addSymbol(m.symbol)}
                    className="flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {m.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {m.symbol}
                    </span>
                    {added ? (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        추가됨
                      </span>
                    ) : (
                      <Plus
                        size={14}
                        aria-hidden
                        className="shrink-0 text-muted-foreground"
                      />
                    )}
                  </button>
                </li>
              );
            })}

            {results.length === 0 && isBareCode ? (
              <li>
                <button
                  type="button"
                  onClick={() => addStock(query)}
                  className="flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    이 코드로 직접 추가
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {query.trim()}
                  </span>
                  <Plus
                    size={14}
                    aria-hidden
                    className="shrink-0 text-muted-foreground"
                  />
                </button>
              </li>
            ) : results.length === 0 ? (
              <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
                검색 결과가 없습니다. 6자리 코드(예: 005930)를 직접 입력할 수도 있어요.
              </li>
            ) : null}
          </ul>

          <p className="text-[11px] text-muted-foreground">
            회사명 일부 또는 종목코드로 검색하세요. 미국은 지수만 제공합니다(개별 종목 미지원).
          </p>
        </div>
      </fieldset>
    </div>
  );
}

export default SymbolManager;
