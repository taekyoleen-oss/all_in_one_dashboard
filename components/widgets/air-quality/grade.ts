/**
 * air-quality · Korean (환경부) 4-tier grading for PM concentrations.
 *
 *  The 환경부 통합대기환경지수(CAI) breakpoints for 24h PM, mapped to the familiar
 *  4 grades. Tone is conveyed by BOTH a color token and a label/emoji — never
 *  color alone (설계서 접근성 규칙). µg/m³ in, grade out.
 */

export type AirGradeKey = "good" | "moderate" | "bad" | "very-bad" | "none";

export interface AirGrade {
  key: AirGradeKey;
  /** Korean label (좋음/보통/나쁨/매우나쁨). */
  label: string;
  /** Face emoji reinforcing the grade without relying on color. */
  emoji: string;
  /** Tailwind text color class (semantic, theme-aware). */
  textClass: string;
  /** Tailwind background tint class for chips/bars. */
  bgClass: string;
}

const GRADES: Record<Exclude<AirGradeKey, "none">, Omit<AirGrade, "key">> = {
  good: {
    label: "좋음",
    emoji: "😊",
    textClass: "text-sky-600 dark:text-sky-400",
    bgClass: "bg-sky-500/15",
  },
  moderate: {
    label: "보통",
    emoji: "🙂",
    textClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/15",
  },
  bad: {
    label: "나쁨",
    emoji: "😷",
    textClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/15",
  },
  "very-bad": {
    label: "매우나쁨",
    emoji: "🤢",
    textClass: "text-red-600 dark:text-red-400",
    bgClass: "bg-red-500/15",
  },
};

const NONE: AirGrade = {
  key: "none",
  label: "—",
  emoji: "❔",
  textClass: "text-muted-foreground",
  bgClass: "bg-muted",
};

function gradeFrom(
  value: number | undefined,
  breaks: [number, number, number],
): AirGrade {
  if (value === undefined || !Number.isFinite(value)) return NONE;
  let key: Exclude<AirGradeKey, "none">;
  if (value <= breaks[0]) key = "good";
  else if (value <= breaks[1]) key = "moderate";
  else if (value <= breaks[2]) key = "bad";
  else key = "very-bad";
  return { key, ...GRADES[key] };
}

/** PM₂.₅ (µg/m³): 좋음 ≤15, 보통 ≤35, 나쁨 ≤75, 매우나쁨 >75. */
export function gradePm25(v: number | undefined): AirGrade {
  return gradeFrom(v, [15, 35, 75]);
}

/** PM₁₀ (µg/m³): 좋음 ≤30, 보통 ≤80, 나쁨 ≤150, 매우나쁨 >150. */
export function gradePm10(v: number | undefined): AirGrade {
  return gradeFrom(v, [30, 80, 150]);
}

/** O₃ (µg/m³, ≈ ppm×1960): 좋음 ≤60, 보통 ≤120, 나쁨 ≤196, 매우나쁨 >196. */
export function gradeO3(v: number | undefined): AirGrade {
  return gradeFrom(v, [60, 120, 196]);
}

/** NO₂ (µg/m³): 좋음 ≤57, 보통 ≤113, 나쁨 ≤226, 매우나쁨 >226. */
export function gradeNo2(v: number | undefined): AirGrade {
  return gradeFrom(v, [57, 113, 226]);
}

/** The worse of two grades (higher severity wins) — for an overall headline. */
export function worseGrade(a: AirGrade, b: AirGrade): AirGrade {
  const order: AirGradeKey[] = ["none", "good", "moderate", "bad", "very-bad"];
  return order.indexOf(a.key) >= order.indexOf(b.key) ? a : b;
}
