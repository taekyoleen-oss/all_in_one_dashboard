/**
 * 시장지표(국내 금·브렌트유·미 10년 국채금리) — SERVER-ONLY.
 *
 *  환율 위젯이 "환율이 왜 움직이는지"를 같이 보여 주기 위한 세 줄이다(요구).
 *  전부 **키가 필요 없는 공개 소스**이고, 화면에 출처를 함께 표시한다(요구).
 *
 *  ┌ 국내 금  KRX 금현물 1g(원)  ← 네이버 시장지표 metals (`M04020000`)
 *  ├ 브렌트유 USD/BBL            ← 네이버 시장지표 energy
 *  └ 미 10년  %                  ← Yahoo chart `^TNX`(주식 위젯이 쓰는 그 경로)
 *
 *  ⚠ 네이버 시장지표 API는 **비공식**이다(문서 없음). 값은 정확하지만 모양이
 *    말없이 바뀔 수 있으므로 ⒜ 파싱 실패는 그 줄만 빠지게 하고(다른 줄·환율은
 *    그대로), ⒝ 국제 상품인 브렌트유는 Yahoo(`BZ=F`)를 폴백으로 둔다. 국내 금은
 *    Yahoo에 대응 종목이 없어 폴백이 없다 — 실패하면 그 줄만 사라진다.
 *
 *  ⚠ 같은 이름이라도 출처가 다르면 숫자가 다르다(브렌트: 네이버 104.32 vs
 *    Yahoo 선물 97.44 — 월물이 다름). 그래서 **줄마다 출처를 못 박고** 화면에도
 *    그 출처를 적는다.
 *
 *  시세는 개인 본인 용도(재배포 금지) — 가드레일과 같은 선.
 */
import type { MarketIndicator } from "@/output/api-shapes";

/** 지원하는 지표 키(요구: 이 셋). */
export const INDICATOR_KEYS = ["gold-kr", "brent", "ust10y"] as const;
export type IndicatorKey = (typeof INDICATOR_KEYS)[number];

const UA = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  accept: "application/json",
} as const;

/**
 * 60초 메모 캐시 — 웹 훅과 폰 브리지가 같은 서버에서 자주 부른다. 지표는
 * 분 단위로 움직이므로 1분이면 화면상 차이가 없고, 공개 소스에 대한 예의이기도 하다.
 */
let cache: { at: number; values: MarketIndicator[] } | null = null;
const TTL_MS = 60_000;

/** 네이버 시장지표 한 묶음(metals·energy 등) — 실패하면 빈 배열. */
async function naver(category: "metals" | "energy"): Promise<Array<Record<string, unknown>>> {
  try {
    const r = await fetch(`https://api.stock.naver.com/marketindex/${category}`, {
      headers: UA,
      cache: "no-store",
    });
    if (!r.ok) return [];
    const j: unknown = await r.json();
    if (Array.isArray(j)) return j as Array<Record<string, unknown>>;
    // energy는 { normalList: [...] } 모양으로도 온다.
    const list = (j as { normalList?: unknown })?.normalList;
    return Array.isArray(list) ? (list as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

/** "189,500" → 189500 (네이버는 숫자를 콤마 문자열로 준다). */
function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 네이버는 등락률을 **부호 없이** 주고 방향은 fluctuationsType에 있다. */
function signedPct(row: Record<string, unknown>): number | undefined {
  const raw = num(row.fluctuationsRatio);
  if (raw === null) return undefined;
  const dir = (row.fluctuationsType as { code?: string } | undefined)?.code;
  // 5=하락, 2=상승(네이버 코드). 이미 음수면 그대로 둔다.
  return dir === "5" && raw > 0 ? -raw : raw;
}

/** Yahoo chart 한 종목 — 주식 위젯과 같은 엔드포인트. */
async function yahoo(symbol: string): Promise<{ price: number; changePct?: number } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
      { headers: UA, cache: "no-store" },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      chart?: { result?: Array<{ meta?: Record<string, unknown> }> };
    };
    const meta = j.chart?.result?.[0]?.meta;
    const price = num(meta?.regularMarketPrice);
    if (price === null) return null;
    const prev = num(meta?.previousClose) ?? num(meta?.chartPreviousClose);
    const changePct = prev && prev !== 0 ? ((price - prev) / prev) * 100 : undefined;
    return { price, changePct };
  } catch {
    return null;
  }
}

/**
 * 세 지표를 병렬로 받는다. **못 받은 줄은 빠진다**(빈 값으로 채우지 않는다) —
 * "—"만 남은 줄은 정보가 아니라 고장으로 보인다.
 */
export async function fetchIndicators(): Promise<MarketIndicator[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;

  const [metals, energy, tnx] = await Promise.all([
    naver("metals"),
    naver("energy"),
    yahoo("^TNX"),
  ]);

  const out: MarketIndicator[] = [];

  const gold = metals.find((m) => m.reutersCode === "M04020000");
  const goldPrice = num(gold?.closePrice);
  if (goldPrice !== null) {
    out.push({
      key: "gold-kr",
      name: "국내 금",
      value: goldPrice,
      unit: "원/g",
      changePct: signedPct(gold as Record<string, unknown>),
      source: "KRX·네이버",
    });
  }

  const brent = energy.find((m) => typeof m.name === "string" && m.name.includes("브렌트"));
  const brentPrice = num(brent?.closePrice);
  if (brentPrice !== null) {
    out.push({
      key: "brent",
      name: "브렌트유",
      value: brentPrice,
      unit: "USD/배럴",
      changePct: signedPct(brent as Record<string, unknown>),
      source: "네이버",
    });
  } else {
    // 네이버가 모양을 바꿨을 때의 폴백 — 같은 이름이지만 **선물 월물**이라 값이 다르다.
    const bz = await yahoo("BZ=F");
    if (bz) {
      out.push({
        key: "brent",
        name: "브렌트유(선물)",
        value: bz.price,
        unit: "USD/배럴",
        changePct: bz.changePct,
        source: "Yahoo",
      });
    }
  }

  if (tnx) {
    out.push({
      key: "ust10y",
      name: "미 10년 국채",
      value: tnx.price,
      unit: "%",
      changePct: tnx.changePct,
      source: "Yahoo",
    });
  }

  cache = { at: Date.now(), values: out };
  return out;
}
