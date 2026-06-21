/**
 * 외출옷 추천 — 도메인 타입 (Weather_Outfit_Suggestion 앱에서 이식).
 *
 *  원본 앱의 `types/outfit.ts` + `types/weather.ts`의 일러스트·추천에 필요한 타입을
 *  위젯 내부로 통합했다(전역 타입 오염 방지, 위젯 자체완결).
 */

/** 하늘 상태 코드 (기상청): 1=맑음 3=구름많음 4=흐림 */
export type SkyCode = "1" | "3" | "4";
/** 강수 형태 코드 (기상청): 0=없음 1=비 2=비/눈 3=눈 4=소나기 */
export type PtyCode = "0" | "1" | "2" | "3" | "4";

/** 복장 일러스트 상단 날씨 데코용 */
export interface OutfitWeatherSnapshot {
  skyCode: SkyCode;
  ptyCode: PtyCode;
}

export type ActivityType =
  | "urban_walk" // 산책·쇼핑 등 일상 외출
  | "running" // 달리기·조깅
  | "cycling" // 자전거
  | "golf" // 골프
  | "hiking" // 등산·트레킹
  | "picnic" // 소풍·캠핑
  | "river" // 강변
  | "beach" // 해변·해수욕
  | "ski" // 스키·스노보드
  | "tennis"; // 테니스·배드민턴

export type GenderType = "male" | "female";

export type OutfitCategory =
  | "base" // 이너·속옷
  | "top" // 상의
  | "mid" // 미들레이어
  | "outer" // 아우터
  | "bottom" // 하의
  | "foot" // 신발·양말
  | "acc" // 액세서리
  | "rain" // 우산·우비
  | "mask"; // 마스크

export interface OutfitItem {
  id: string;
  name: string;
  icon: string;
  category: OutfitCategory;
  required: boolean;
  condition?: string;
  colorHint?: string;
  activityTag?: string;
  timePeriodIds?: string[];
}

export type DangerLevel = "none" | "caution" | "warning" | "cancel";

/** 체감 구간 — weather-outdoor-clothing-guide.md 라.2 기준 */
export type TempZone =
  | "hot" // 28°C 이상
  | "warm" // 23~27°C
  | "mild" // 18~22°C
  | "cool" // 12~17°C
  | "cold" // 6~11°C
  | "freezing"; // 0~5℃ 및 0℃ 미만

export type HeroIllustKey =
  | "summer-light"
  | "summer-sport"
  | "spring-mild"
  | "fall-layered"
  | "winter-heavy"
  | "rain-gear"
  | "snow-gear"
  | "beach-look"
  | "ski-look"
  | "golf-look";

export interface OutfitInput {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  ptyCode: string; // '0'=없음 '1'=비 '2'=비눈 '3'=눈 '4'=소나기
  dustGrade: string; // '1'=좋음 '2'=보통 '3'=나쁨 '4'=매우나쁨
  o3Grade?: string;
  precipitation: number; // mm (1시간 강수량)
  activity: ActivityType;
  gender: GenderType;
  hour: number; // 시작 시간 (24h)
  duration: number; // 지속 시간 (시간)
  terrain: string;
}

export interface OutfitResult {
  items: OutfitItem[];
  heroIllust: HeroIllustKey;
  layerLevel: number; // 1=얇게 / 2=기본 / 3=두껍게
  layerLabel: string;
  tempZone: TempZone;
  uvAlert: boolean;
  dustAlert: boolean;
  rainAlert: boolean;
  windAlert: boolean;
  precipitation: number;
  tips: string[];
  microclimateNote?: string;
  dangerLevel: DangerLevel;
  dangerReasons: string[];
  cancelActivity: boolean;
  ozoneTimeWarning: string | null;
}
