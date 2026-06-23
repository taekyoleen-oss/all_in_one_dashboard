/**
 * unit-converter · unit catalog + conversion (단위/환산 변환).
 *
 *  Every category is factor-based relative to a category base unit (so any→any
 *  is base*from → /to), EXCEPT temperature which needs offsets and is special-
 *  cased in convert(). Pure + deterministic; no external API. Includes 한국 단위
 *  (평·근·돈·관) for everyday use.
 */

export interface Unit {
  /** Stable key (config stores this). */
  id: string;
  /** Display label, e.g. "킬로미터 (km)". */
  label: string;
  /** Multiplier to the category's base unit (ignored for temperature). */
  factor: number;
}

export interface UnitCategory {
  id: string;
  label: string;
  units: Unit[];
  /** Default from/to unit ids for a fresh pick. */
  defaultFrom: string;
  defaultTo: string;
}

export const CATEGORIES: UnitCategory[] = [
  {
    id: "length",
    label: "길이",
    defaultFrom: "m",
    defaultTo: "km",
    units: [
      { id: "mm", label: "밀리미터 (mm)", factor: 0.001 },
      { id: "cm", label: "센티미터 (cm)", factor: 0.01 },
      { id: "m", label: "미터 (m)", factor: 1 },
      { id: "km", label: "킬로미터 (km)", factor: 1000 },
      { id: "in", label: "인치 (in)", factor: 0.0254 },
      { id: "ft", label: "피트 (ft)", factor: 0.3048 },
      { id: "yd", label: "야드 (yd)", factor: 0.9144 },
      { id: "mile", label: "마일 (mi)", factor: 1609.344 },
      { id: "ja", label: "자 (尺)", factor: 0.30303 },
      { id: "li", label: "리 (里)", factor: 392.7 },
    ],
  },
  {
    id: "mass",
    label: "무게",
    defaultFrom: "kg",
    defaultTo: "lb",
    units: [
      { id: "mg", label: "밀리그램 (mg)", factor: 0.000001 },
      { id: "g", label: "그램 (g)", factor: 0.001 },
      { id: "kg", label: "킬로그램 (kg)", factor: 1 },
      { id: "ton", label: "톤 (t)", factor: 1000 },
      { id: "lb", label: "파운드 (lb)", factor: 0.45359237 },
      { id: "oz", label: "온스 (oz)", factor: 0.0283495231 },
      { id: "don", label: "돈", factor: 0.00375 },
      { id: "geun", label: "근 (斤·600g)", factor: 0.6 },
      { id: "gwan", label: "관 (貫)", factor: 3.75 },
    ],
  },
  {
    id: "temperature",
    label: "온도",
    defaultFrom: "c",
    defaultTo: "f",
    units: [
      { id: "c", label: "섭씨 (°C)", factor: 1 },
      { id: "f", label: "화씨 (°F)", factor: 1 },
      { id: "k", label: "켈빈 (K)", factor: 1 },
    ],
  },
  {
    id: "area",
    label: "넓이",
    defaultFrom: "m2",
    defaultTo: "pyeong",
    units: [
      { id: "cm2", label: "제곱센티미터 (㎠)", factor: 0.0001 },
      { id: "m2", label: "제곱미터 (㎡)", factor: 1 },
      { id: "km2", label: "제곱킬로미터 (㎢)", factor: 1000000 },
      { id: "ha", label: "헥타르 (ha)", factor: 10000 },
      { id: "ft2", label: "제곱피트 (ft²)", factor: 0.092903 },
      { id: "pyeong", label: "평 (坪)", factor: 3.305785 },
      { id: "acre", label: "에이커 (acre)", factor: 4046.8564 },
    ],
  },
  {
    id: "volume",
    label: "부피",
    defaultFrom: "l",
    defaultTo: "ml",
    units: [
      { id: "ml", label: "밀리리터 (mL)", factor: 0.001 },
      { id: "l", label: "리터 (L)", factor: 1 },
      { id: "m3", label: "세제곱미터 (㎥)", factor: 1000 },
      { id: "cup", label: "컵 (200mL)", factor: 0.2 },
      { id: "floz", label: "액량온스 (fl oz)", factor: 0.0295735 },
      { id: "gal", label: "갤런 (US gal)", factor: 3.785411784 },
      { id: "doe", label: "되", factor: 1.8039 },
      { id: "mal", label: "말 (斗)", factor: 18.039 },
    ],
  },
  {
    id: "speed",
    label: "속도",
    defaultFrom: "kmh",
    defaultTo: "ms",
    units: [
      { id: "ms", label: "초속 (m/s)", factor: 1 },
      { id: "kmh", label: "시속 (km/h)", factor: 0.2777778 },
      { id: "mph", label: "마일/시 (mph)", factor: 0.44704 },
      { id: "knot", label: "노트 (knot)", factor: 0.5144444 },
    ],
  },
  {
    id: "time",
    label: "시간",
    defaultFrom: "min",
    defaultTo: "s",
    units: [
      { id: "ms", label: "밀리초 (ms)", factor: 0.001 },
      { id: "s", label: "초 (s)", factor: 1 },
      { id: "min", label: "분 (min)", factor: 60 },
      { id: "h", label: "시간 (h)", factor: 3600 },
      { id: "day", label: "일 (day)", factor: 86400 },
      { id: "week", label: "주 (week)", factor: 604800 },
    ],
  },
  {
    id: "data",
    label: "데이터",
    defaultFrom: "mb",
    defaultTo: "gb",
    units: [
      { id: "b", label: "바이트 (B)", factor: 1 },
      { id: "kb", label: "킬로바이트 (KB)", factor: 1024 },
      { id: "mb", label: "메가바이트 (MB)", factor: 1048576 },
      { id: "gb", label: "기가바이트 (GB)", factor: 1073741824 },
      { id: "tb", label: "테라바이트 (TB)", factor: 1099511627776 },
    ],
  },
];

export function findCategory(id: string): UnitCategory {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}

export function findUnit(cat: UnitCategory, id: string): Unit {
  return cat.units.find((u) => u.id === id) ?? cat.units[0];
}

/* ------------------------------- temperature ------------------------------ */

function toCelsius(value: number, from: string): number {
  if (from === "f") return ((value - 32) * 5) / 9;
  if (from === "k") return value - 273.15;
  return value;
}
function fromCelsius(celsius: number, to: string): number {
  if (to === "f") return (celsius * 9) / 5 + 32;
  if (to === "k") return celsius + 273.15;
  return celsius;
}

/**
 * Convert `value` from unit `fromId` to `toId` within `categoryId`. Returns NaN
 * if the value isn't finite. Temperature is offset-based; everything else is a
 * pure ratio of factors.
 */
export function convert(
  value: number,
  categoryId: string,
  fromId: string,
  toId: string,
): number {
  if (!Number.isFinite(value)) return NaN;
  const cat = findCategory(categoryId);
  if (cat.id === "temperature") {
    return fromCelsius(toCelsius(value, fromId), toId);
  }
  const from = findUnit(cat, fromId);
  const to = findUnit(cat, toId);
  return (value * from.factor) / to.factor;
}

/** Trim a converted number to a readable precision (keeps small values exact). */
export function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 0.0001 || abs >= 1e12)) return n.toExponential(4);
  // Up to 6 significant decimals, then strip trailing zeros.
  const fixed = n.toFixed(6);
  return parseFloat(fixed).toLocaleString("ko-KR", {
    maximumFractionDigits: 6,
  });
}
