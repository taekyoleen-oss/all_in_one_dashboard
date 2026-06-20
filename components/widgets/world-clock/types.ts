/**
 * world-clock widget — config shape (설계서 §2.2: 다중 시간대, 클라이언트 IANA TZ).
 *
 *  Client-only: times are derived with Intl.DateTimeFormat({ timeZone }) — no
 *  external API. Each zone has a stable id for keying + reordering.
 */
export interface ClockZone {
  /** Stable id (for list keys + reorder). */
  id: string;
  /** IANA timezone, e.g. "Asia/Seoul". */
  timeZone: string;
  /** User label, e.g. "서울". */
  label: string;
}

export interface WorldClockConfig {
  zones: ClockZone[];
  /** 24h vs 12h display. */
  hour12: boolean;
  /** Show the seconds digits. */
  showSeconds: boolean;
}

export const DEFAULT_WORLD_CLOCK_CONFIG: WorldClockConfig = {
  zones: [
    { id: "seoul", timeZone: "Asia/Seoul", label: "서울" },
    { id: "newyork", timeZone: "America/New_York", label: "뉴욕" },
    { id: "london", timeZone: "Europe/London", label: "런던" },
  ],
  hour12: false,
  showSeconds: true,
};

/** A small curated list of common IANA zones for the picker (free text also ok). */
export const COMMON_ZONES: { timeZone: string; label: string }[] = [
  { timeZone: "Asia/Seoul", label: "서울" },
  { timeZone: "Asia/Tokyo", label: "도쿄" },
  { timeZone: "Asia/Shanghai", label: "상하이" },
  { timeZone: "Asia/Singapore", label: "싱가포르" },
  { timeZone: "Asia/Kolkata", label: "뉴델리" },
  { timeZone: "Asia/Dubai", label: "두바이" },
  { timeZone: "Europe/London", label: "런던" },
  { timeZone: "Europe/Paris", label: "파리" },
  { timeZone: "Europe/Berlin", label: "베를린" },
  { timeZone: "Europe/Moscow", label: "모스크바" },
  { timeZone: "America/New_York", label: "뉴욕" },
  { timeZone: "America/Chicago", label: "시카고" },
  { timeZone: "America/Denver", label: "덴버" },
  { timeZone: "America/Los_Angeles", label: "로스앤젤레스" },
  { timeZone: "America/Sao_Paulo", label: "상파울루" },
  { timeZone: "Australia/Sydney", label: "시드니" },
  { timeZone: "Pacific/Auckland", label: "오클랜드" },
  { timeZone: "UTC", label: "UTC" },
];

/** Validate an IANA timezone via the Intl runtime (returns false if unsupported). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
