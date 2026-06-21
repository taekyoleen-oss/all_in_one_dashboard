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
import { periodById, sensitivityOffset } from "./constants";

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

/** 선택 시간대의 시간별 예보를 찾는다(없으면 null → 현재값 폴백). */
function findHourly(
  weather: Weather,
  repHour: number,
): Weather["hourly"][number] | null {
  const now = Date.now();
  let best: Weather["hourly"][number] | null = null;
  let bestTs = Infinity;
  for (const h of weather.hourly) {
    const d = new Date(h.ts);
    if (d.getHours() !== repHour) continue;
    // 과거(1시간 이전)는 제외, 가장 가까운 미래의 같은 시각을 선택.
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
  const period = opts.periodId
    ? periodById(opts.periodId)
    : periodById(
        // periodId 미지정 시 현재 시각 구간.
        ["dawn", "h07_09", "h10_12", "h13_15", "h16_18", "h19_21", "h21_23"][
          (() => {
            const hr = new Date().getHours();
            if (hr < 7) return 0;
            if (hr < 10) return 1;
            if (hr < 13) return 2;
            if (hr < 16) return 3;
            if (hr < 19) return 4;
            if (hr < 22) return 5;
            return 6;
          })()
        ],
      );
  const repHour = period.repHour;
  const calendarMonth = new Date().getMonth() + 1;

  const cur = weather.current;
  const flDelta =
    typeof cur.feelsLike === "number" ? cur.feelsLike - cur.temp : 0;

  const hourly = findHourly(weather, repHour);
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
    periodLabel: period.label,
    fromHourly: hourly != null,
    calendarMonth,
  };
}
