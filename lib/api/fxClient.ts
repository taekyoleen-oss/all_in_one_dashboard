/**
 * ============================================================================
 *  FX client — currency rates, keyless, WORKS TODAY (설계서 §2.2, §11.1)
 * ============================================================================
 *
 *  SERVER-ONLY. Normalizes external rate data into the shared `FxRates` shape
 *  (output/api-shapes.ts — the anti-drift single source). The default source is
 *  the **keyless Frankfurter API** (https://api.frankfurter.app — ECB daily
 *  reference rates), so the 환율 widget works on day one with zero setup.
 *
 *  If `FX_API_KEY` is ever set, a keyed provider can be slotted in behind the
 *  same `fetchRates()` contract; today the key is simply unused (Frankfurter
 *  needs none). The route never exposes any upstream key to the client.
 *
 *  Caching is handled at the route layer (Next `revalidate`); this module just
 *  fetches + normalizes and never throws raw upstream errors to the caller.
 * ============================================================================
 */

// SERVER-ONLY: imported only from app/api/fx/route.ts. No secret is required for
// the keyless source; if FX_API_KEY is added it stays inside this module.
import type { FxRates } from "@/output/api-shapes";

/** Per-request timeout so a slow upstream can't wedge the route. */
const FETCH_TIMEOUT_MS = 8_000;
const FRANKFURTER_BASE = "https://api.frankfurter.app/latest";

/** Default base + quote currencies when the request omits them. */
export const DEFAULT_FX_BASE = "USD";
export const DEFAULT_FX_SYMBOLS = ["KRW", "EUR", "JPY", "CNY"] as const;

/** Shape we read out of Frankfurter's /latest response. */
interface FrankfurterLatest {
  base?: string;
  date?: string;
  rates?: Record<string, number>;
}

/** Normalize a free-form currency token to an upper-cased 3-letter code, or null. */
export function normalizeCode(raw: string): string | null {
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** Parse a comma/space separated `symbols` param into unique valid codes. */
export function parseSymbolsParam(
  raw: string | null,
  fallback: readonly string[] = DEFAULT_FX_SYMBOLS,
): string[] {
  if (!raw) return [...fallback];
  const seen = new Set<string>();
  for (const part of raw.split(/[,\s]+/)) {
    const code = normalizeCode(part);
    if (code) seen.add(code);
  }
  return seen.size > 0 ? [...seen] : [...fallback];
}

/**
 * Fetch + normalize current rates for `base` → each of `symbols`.
 * Returns a fully-formed `FxRates` on success, or `null` on any failure (the
 * route maps null to a typed error — never a raw upstream error).
 *
 * Frankfurter rejects a request whose `from` equals one of `to`, and silently
 * omits the base from `rates`; we filter the base out of `symbols` and re-add
 * it as 1.0 so the widget can always show "1 base = 1 base".
 */
export async function fetchRates(
  base: string,
  symbols: string[],
): Promise<FxRates | null> {
  const baseCode = normalizeCode(base) ?? DEFAULT_FX_BASE;
  const wanted = symbols
    .map(normalizeCode)
    .filter((c): c is string => c !== null && c !== baseCode);

  // Nothing left to ask for (e.g. base==quote): return a trivial 1.0 snapshot.
  if (wanted.length === 0) {
    return {
      base: baseCode,
      rates: { [baseCode]: 1 },
      date: new Date().toISOString().slice(0, 10),
      provider: "frankfurter",
      stale: true,
      ts: Date.now(),
    };
  }

  const url = `${FRANKFURTER_BASE}?from=${encodeURIComponent(
    baseCode,
  )}&to=${encodeURIComponent(wanted.join(","))}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      // Route-level caching governs freshness; avoid Next's default fetch cache here.
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as FrankfurterLatest;
    if (!json.rates || typeof json.rates !== "object") return null;

    const rates: Record<string, number> = { [baseCode]: 1 };
    for (const [code, value] of Object.entries(json.rates)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        rates[code] = value;
      }
    }

    return {
      base: baseCode,
      rates,
      date: typeof json.date === "string" ? json.date : new Date().toISOString().slice(0, 10),
      provider: "frankfurter",
      // ECB rates are daily reference rates, not live — flag as approximate.
      stale: true,
      ts: Date.now(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
