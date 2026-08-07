"use client";

/**
 * stock · SymbolManager — toggle indices + add/remove 개별 종목 (설계서 §2.1).
 *
 *  Controlled: reports the whole next config via onChange (the ConfigEditor wires
 *  this to the dialog draft; the parent owns persistence). Two sections:
 *    1. 지수 — checkbox toggles for the curated indices (코스피·코스닥·다우·S&P·나스닥).
 *    2. 개별 종목 — 국내는 번들된 KRX 카탈로그 검색(회사명/코드), 미국 종목·ETF는
 *       /api/stocks/search(Yahoo) 이름 검색 + 티커 직접 입력. 삭제·순서 변경 지원.
 */

import * as React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import {
  INDEX_CATALOG,
  searchKrStocks,
  isIndexSymbol,
  isUsTicker,
  krCode,
  resolveMeta,
} from "@/lib/api/stock/symbols";
import { StockSearchSchema, type StockSearchResult } from "@/output/api-shapes";
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

  // 미국 종목·ETF는 로컬 카탈로그가 없어 서버(/api/stocks/search → Yahoo)로 이름 검색.
  // 응답을 질의와 함께 담아, 렌더 시 현재 질의와 일치할 때만 노출한다(경합·지연 응답
  // 무시 + effect 본문에서 동기 setState 하지 않기 위함).
  const [usHits, setUsHits] = React.useState<{
    q: string;
    results: StockSearchResult[];
  }>({ q: "", results: [] });

  React.useEffect(() => {
    const q = query.trim();
    // 라틴 문자가 없으면(한글 등) 국내 카탈로그만으로 충분 — 호출 생략.
    if (q.length < 2 || !/[A-Za-z]/.test(q)) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/stocks/search?q=${encodeURIComponent(q)}`,
            { signal: ctrl.signal },
          );
          if (!res.ok) return;
          const parsed = StockSearchSchema.safeParse(await res.json());
          if (parsed.success) setUsHits({ q, results: parsed.data.results });
        } catch {
          /* abort·네트워크 실패는 무시(티커 직접 입력 경로가 남아 있다) */
        }
      })();
    }, 300); // 타이핑 중 매 글자 요청하지 않도록 디바운스
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const usResults = usHits.q === query.trim() ? usHits.results : [];
  // 검색 결과가 없어도 직접 추가 가능한 입력: 국내 6자리 코드 또는 미국 티커(AAPL·SPY).
  const typed = query.trim();
  const directAdd =
    krCode(typed) !== null ? "kr" : isUsTicker(typed) ? "us" : null;

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
    const isKr = krCode(s) !== null;
    if (!isKr && !isUsTicker(s)) {
      setErr(
        "국내는 6자리 종목코드(005930, 035720.KQ), 미국은 티커(AAPL, SPY)를 입력하세요.",
      );
      return;
    }
    // 미국 티커는 대문자로 정규화(야후 심볼 표기와 일치, 중복 추가 방지).
    const symbol = isKr ? s : s.toUpperCase();
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
          개별 종목 (국내 · 미국)
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
              추가된 종목이 없습니다.
            </li>
          ) : null}
        </ul>

        {/* Add by SEARCH — type a company name or code, then pick a result. */}
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            종목 검색 — 국내 회사명·코드 / 미국은 영문 이름·티커
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
              placeholder="삼성, 005930, apple, dividend etf…"
              className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {err ? <p className="text-xs text-destructive">{err}</p> : null}

          {/* Results (click to add). Falls back to a direct 6-digit code add. */}
          <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto pb-scroll">
            {/* 직접 추가 — 국내 코드/미국 티커를 그대로 심볼로 등록(미국은 카탈로그 없음). */}
            {directAdd ? (
              <li>
                <button
                  type="button"
                  onClick={() => addStock(typed)}
                  className="flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {directAdd === "us" ? "이 미국 티커로 추가" : "이 코드로 직접 추가"}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {directAdd === "us" ? typed.toUpperCase() : typed}
                  </span>
                  <Plus
                    size={14}
                    aria-hidden
                    className="shrink-0 text-muted-foreground"
                  />
                </button>
              </li>
            ) : null}

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

            {/* 미국 종목·ETF 이름 검색 결과 (서버 조회) */}
            {usResults.length > 0 ? (
              <li className="px-1 pt-1 text-[10px] font-medium text-muted-foreground">
                미국 주식 · ETF
              </li>
            ) : null}
            {usResults.map((r) => {
              const added = has(r.symbol);
              return (
                <li key={`us:${r.symbol}`}>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => addSymbol(r.symbol)}
                    className="flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {r.name}
                      {r.type === "ETF" ? (
                        <span className="ml-1 align-middle text-[10px] text-muted-foreground">
                          ETF
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {r.symbol}
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

            {results.length === 0 && usResults.length === 0 && !directAdd ? (
              <li className="rounded-md border border-dashed border-border px-2 py-3 text-center text-xs text-muted-foreground">
                검색 결과가 없습니다. 6자리 코드(005930)나 미국 티커(AAPL)를 입력해 보세요.
              </li>
            ) : null}
          </ul>

          <p className="text-[11px] text-muted-foreground">
            국내는 회사명·코드로, 미국 주식·ETF는 영문 이름이나 티커로 검색하세요
            (예: apple, dividend etf, SPY). 미국 시세·종목명은 야후 파이낸스 기준이며
            약 15분 지연될 수 있습니다.
          </p>
        </div>
      </fieldset>
    </div>
  );
}

export default SymbolManager;
