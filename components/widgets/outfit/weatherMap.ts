/**
 * weatherMap — PaneBoard /api/weather(Weather) → 외출옷 추천 입력(OutfitInput) 변환.
 *
 *  원본 앱은 기상청(KMA) 코드(skyCode/ptyCode·UV·미세먼지)를 직접 받지만, PaneBoard의
 *  날씨 API는 source-neutral 한 condition 열거형 + 시간별 temp/pop만 제공한다. 추천
 *  로직(특히 체감 구간·강수·바람)이 동작하도록 가용 정보를 매핑/근사한다:
 *    • feelsLike   : 선택 시간대의 시간별 기온 + (현재 feelsLike−현재 기온) 보정
 *    • ptyCode/sky : condition → 기상청 코드 근사
 *    • precip(mm)  : condition + pop 으로 시간당 강수 근사
 *    • uvIndex     : 시간·계절·하늘상태로 근사 (API에 UV 없음)
 *    • dust        : 정보 없음 → '1'(좋음)
 *  미세먼지/오존 미수신이라 관련 액세서리/경고만 빠질 뿐, 핵심 일러스트는 동일하게 동작.
 */

import type { Weather, WeatherCondition } from "@/output/api-shapes";
import type {
  ActivityType,
  GenderType,
  OutfitInput,
  PtyCode,
  SkyCode,
} from "./illustration/types";
import {
  currentPeriodId,
  parsePeriodKey,
  periodById,
  sensitivityOffset,
} from "./constants";

/** condition → 기상청 강수형태/하늘상태 코드 근사. */
function conditionToCodes(c: WeatherCondition): {
  ptyCode: PtyCode;
  skyCode: SkyCode;
} {
  switch (c) {
    case "rain":
      return { ptyCode: "1", skyCode: "4" };
    case "thunderstorm":
      return { ptyCode: "4", skyCode: "4" };
    case "snow":
      return { ptyCode: "3", skyCode: "4" };
    case "sleet":
      return { ptyCode: "2", skyCode: "4" };
    case "clear":
      return { ptyCode: "0", skyCode: "1" };
    case "partly-cloudy":
      return { ptyCode: "0", skyCode: "3" };
    case "cloudy":
    case "fog":
      return { ptyCode: "0", skyCode: "4" };
    default:
      return { ptyCode: "0", skyCode: "3" };
  }
}

/** condition + pop(%) → 시간당 강수량(mm/h) 근사. */
function estimatePrecip(c: WeatherCondition, pop: number | undefined): number {
  const p = pop ?? 0;
  switch (c) {
    case "thunderstorm":
      return p >= 60 ? 8 : 4;
    case "rain":
      return p >= 70 ? 6 : p >= 40 ? 2 : 1;
    case "snow":
    case "sleet":
      return p >= 60 ? 3 : 1;
    default:
      return 0;
  }
}

/** 시간·계절·하늘상태로 UV 지수 근사 (API에 UV 없음). */
function estimateUv(c: WeatherCondition, hour: number, month: number): number {
  if (hour < 8 || hour >= 17) return 0; // 야간·저녁엔 사실상 0
  const summer = month >= 5 && month <= 8;
  const shoulder = month >= 3 && month <= 10;
  const peak = summer ? 8 : shoulder ? 6 : 3;
  const hourFactor =
    hour >= 11 && hour <= 14 ? 1 : hour >= 9 && hour <= 15 ? 0.7 : 0.45;
  const cloud =
    c === "clear"
      ? 1
      : c === "partly-cloudy"
        ? 0.7
        : c === "cloudy" || c === "fog"
          ? 0.4
          : 0.2;
  return Math.max(0, Math.round(peak * hourFactor * cloud));
}

export interface OutfitSnapshot {
  input: OutfitInput;
  ptyCode: PtyCode;
  skyCode: SkyCode;
  precipitation: number;
  isNight: boolean;
  showSunshine: boolean;
  feelsLike: number;
  condition: WeatherCondition;
  hour: number;
  periodLabel: string;
  /** 시간대 날씨가 시간별 예보에서 잡혔는지(아니면 현재값 폴백). */
  fromHourly: boolean;
  calendarMonth: number;
}

/**
 * 선택 시간대(특정 날의 repHour)의 시간별 예보를 찾는다.
 *  1순위: 앵커(오늘/내일 날짜) + 같은 시각 → '내일 16~18시' 같은 칩이 내일 예보를 정확히 잡음.
 *  2순위: 같은 날 데이터가 없으면 가장 가까운 미래의 같은 시각(데이터 갭 폴백).
 * 모두 없으면 null → 호출부가 현재값으로 폴백.
 */
function findHourly(
  weather: Weather,
  repHour: number,
  anchorTs: number,
): Weather["hourly"][number] | null {
  const anchor = new Date(anchorTs);
  const sameDay = (d: Date) =>
    d.getFullYear() === anchor.getFullYear() &&
    d.getMonth() === anchor.getMonth() &&
    d.getDate() === anchor.getDate();
  // 1순위: 앵커 날짜 + 같은 시각.
  for (const h of weather.hourly) {
    const d = new Date(h.ts);
    if (d.getHours() === repHour && sameDay(d)) return h;
  }
  // 2순위: 가장 가까운 미래의 같은 시각.
  const now = Date.now();
  let best: Weather["hourly"][number] | null = null;
  let bestTs = Infinity;
  for (const h of weather.hourly) {
    if (new Date(h.ts).getHours() !== repHour) continue;
    if (h.ts < now - 60 * 60 * 1000) continue;
    if (h.ts < bestTs) {
      bestTs = h.ts;
      best = h;
    }
  }
  return best;
}

export function buildOutfitSnapshot(
  weather: Weather,
  opts: {
    gender: GenderType;
    activity: ActivityType;
    sensitivity: string;
    periodId?: string;
  },
): OutfitSnapshot {
  const now = new Date();
  // periodId 키('h10_12' 또는 '내일'을 뜻하는 'h10_12@1')를 baseId + dayOffset로 분해.
  // 미지정이면 현재 시각이 속한 오늘 구간.
  const parsed = parsePeriodKey(opts.periodId ?? currentPeriodId(now));
  const period = periodById(parsed.baseId);
  const dayOffset = parsed.dayOffset;
  const repHour = period.repHour;
  // 앵커 = 선택한 날(오늘/내일)의 대표 시각 → 그 날짜의 예보를 정확히 매칭.
  const anchor = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + dayOffset,
    repHour,
    0,
    0,
    0,
  );
  const calendarMonth = anchor.getMonth() + 1;

  const cur = weather.current;
  const flDelta =
    typeof cur.feelsLike === "number" ? cur.feelsLike - cur.temp : 0;

  const hourly = findHourly(weather, repHour, anchor.getTime());
  const temp = hourly ? hourly.temp : cur.temp;
  const condition = hourly ? hourly.condition : cur.condition;
  const pop = hourly ? hourly.pop : cur.pop;

  const sensOffset = sensitivityOffset(opts.sensitivity);
  const feelsLike = temp + flDelta + sensOffset;

  const { ptyCode, skyCode } = conditionToCodes(condition);
  const precipitation = estimatePrecip(condition, pop);
  const uvIndex = estimateUv(condition, repHour, calendarMonth);
  const isNight = repHour < 7 || repHour >= 19;
  const showSunshine =
    !isNight && (condition === "clear" || condition === "partly-cloudy") && uvIndex >= 3;

  const input: OutfitInput = {
    temperature: temp,
    feelsLike,
    humidity: cur.humidity ?? 55,
    windSpeed: cur.windSpeed ?? 1,
    uvIndex,
    ptyCode,
    dustGrade: "1", // PaneBoard 날씨 API에 미세먼지 없음 → 좋음 가정
    precipitation,
    activity: opts.activity,
    gender: opts.gender,
    hour: repHour,
    duration: 2,
    terrain: "",
  };

  return {
    input,
    ptyCode,
    skyCode,
    precipitation,
    isNight,
    showSunshine,
    feelsLike,
    condition,
    hour: repHour,
    periodLabel: dayOffset === 1 ? `내일 ${period.label}` : period.label,
    fromHourly: hourly != null,
    calendarMonth,
  };
}
