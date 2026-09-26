/**
 * 환율 표시 행 계산 — 웹 훅(useFxRates)과 폰 브리지(/api/widget/fx)가 **함께 쓴다**.
 *
 *  /api/fx는 `base=KRW`로 부르므로 rates[C] = 1원당 C다. 화면에 필요한 값은 그
 *  반대(원화 값)라 뒤집고, 엔화만 100 단위로 본다(한국에서 보는 관례).
 *  전일 대비도 같은 이유로 **부호를 뒤집어야** 한다 — "1원당 달러"가 오르면
 *  "1달러당 원"은 내린다.
 *
 *  두 소비자가 각자 계산하면 폰과 웹의 숫자가 갈라지므로 여기 한 곳에만 둔다.
 */

import { fxUnit } from "./types.ts"; // node --test가 확장자 없는 상대경로를 못 연다(번들러는 동일 해석)

export interface FxRowValues {
  /** 외화 코드(USD·JPY…). */
  code: string;
  /** 표시 단위(엔 100, 나머지 1). */
  unit: number;
  /** `unit` 단위당 원화 값. */
  krw: number;
  /** 전일 대비 퍼센트(원화 값 기준, 부호 있음) — 알 수 없으면 undefined. */
  changePct?: number;
  /** 전일 대비 원화 금액(부호 있음) — changePct가 있을 때만. */
  changeAbs?: number;
}

/** rates(1원당 외화) + changePct(외화 기준) → 원화 기준 표시 행. */
export function fxRows(
  codes: string[],
  rates: Record<string, number>,
  changePct?: Record<string, number>,
): FxRowValues[] {
  const out: FxRowValues[] = [];
  for (const code of codes) {
    const rate = rates[code]; // code per 1 KRW
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate === 0) continue;
    const unit = fxUnit(code);
    const krw = unit / rate;

    const src = changePct?.[code];
    const cp = typeof src === "number" && Number.isFinite(src) ? -src : undefined;
    // 전일 원화값 = krw / (1 + cp/100) → 차이가 곧 전일 대비 금액.
    let changeAbs: number | undefined;
    if (cp !== undefined) {
      const denom = 1 + cp / 100;
      if (denom !== 0) changeAbs = krw - krw / denom;
    }
    out.push({ code, unit, krw, changePct: cp, changeAbs });
  }
  return out;
}

/**
 * 환율 정보 웹페이지 — 웹 행 더블클릭과 폰 위젯이 **함께 쓴다**(주식 quoteInfoUrl과 같은 역할).
 *
 *  이 위젯의 행은 전부 **원화 기준**(krw = unit당 원)이라 네이버 환율 상세의
 *  `FX_{코드}KRW` 페이지가 그대로 맞는다(USD·JPY·EUR·CNY 실측 200). 3자리 코드가
 *  아니면 시장지표 메인으로 보낸다 — 없는 페이지로 보내 404를 보여 주지 않는다.
 */
export function fxInfoUrl(code: string): string {
  const c = code.toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return "https://finance.naver.com/marketindex/";
  return `https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_${c}KRW`;
}
