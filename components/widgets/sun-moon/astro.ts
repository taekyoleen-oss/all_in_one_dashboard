/**
 * sun-moon · astronomy (일출·일몰 + 달 위상) — pure local computation.
 *
 *  No API, no key, works offline. Sun times use the standard NOAA sunrise
 *  equation (accurate to ~1 minute for civil use); moon phase uses the synodic
 *  month from a known new-moon epoch. Inputs are a date + lat/lon; outputs are
 *  local Date objects (built from the device clock's timezone).
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/* ------------------------------- sun times -------------------------------- */

export interface SunTimes {
  /** Sunrise as a Date (local), or null if the sun doesn't rise that day. */
  sunrise: Date | null;
  /** Sunset as a Date (local), or null if the sun doesn't set that day. */
  sunset: Date | null;
  /** Solar noon as a Date (local). */
  solarNoon: Date;
  /** Daylight length in minutes (0 if polar night, 1440 if midnight sun). */
  dayLengthMin: number;
  /** Special polar state, if any. */
  polar: "day" | "night" | null;
}

/** Day-of-year (1–366) for a date in its local timezone. */
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/**
 * Sunrise/sunset for `date` at lat/lon using the NOAA approximation. Returns
 * local Date objects. `zenith` defaults to the official 90.833° (incl. refraction).
 */
export function computeSunTimes(
  date: Date,
  lat: number,
  lon: number,
  zenith = 90.833,
): SunTimes {
  const N = dayOfYear(date);

  // The algorithm computes rise & set in UTC hours, then we place them on the
  // local calendar day via the device timezone offset.
  const calc = (rising: boolean): number | null => {
    const lngHour = lon / 15;
    const t = rising ? N + (6 - lngHour) / 24 : N + (18 - lngHour) / 24;

    const M = 0.9856 * t - 3.289;
    let L =
      M + 1.916 * Math.sin(M * DEG) + 0.02 * Math.sin(2 * M * DEG) + 282.634;
    L = ((L % 360) + 360) % 360;

    let RA = RAD * Math.atan(0.91764 * Math.tan(L * DEG));
    RA = ((RA % 360) + 360) % 360;
    // Co-locate RA quadrant with L.
    const Lquad = Math.floor(L / 90) * 90;
    const RAquad = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquad - RAquad)) / 15;

    const sinDec = 0.39782 * Math.sin(L * DEG);
    const cosDec = Math.cos(Math.asin(sinDec));

    const cosH =
      (Math.cos(zenith * DEG) - sinDec * Math.sin(lat * DEG)) /
      (cosDec * Math.cos(lat * DEG));
    if (cosH > 1) return null; // sun never rises
    if (cosH < -1) return null; // sun never sets

    let H = rising ? 360 - RAD * Math.acos(cosH) : RAD * Math.acos(cosH);
    H = H / 15;

    const T = H + RA - 0.06571 * t - 6.622;
    let UT = T - lngHour;
    UT = ((UT % 24) + 24) % 24;
    return UT; // hours UTC
  };

  const riseUT = calc(true);
  const setUT = calc(false);

  // Build local Date from a UTC hour on the same UTC calendar day as local date.
  const toLocal = (utHours: number | null): Date | null => {
    if (utHours === null) return null;
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    // Midnight (local) expressed in UTC, then add the UT hour. Using Date.UTC of
    // the local Y/M/D approximates the day; sub-day UT placement is what matters.
    const ms = Date.UTC(y, m, d) + utHours * 3_600_000;
    return new Date(ms);
  };

  const sunrise = toLocal(riseUT);
  const sunset = toLocal(setUT);

  // Polar handling: cosH out of range on both → polar day/night by sun altitude.
  let polar: "day" | "night" | null = null;
  if (riseUT === null && setUT === null) {
    // Decide via solar declination vs latitude sign.
    const decl = 23.44 * Math.sin(DEG * ((360 / 365) * (N - 81)));
    const sunUp = lat >= 0 ? decl > 90 - lat - 0.833 : decl < -(90 + lat) + 0.833;
    polar = sunUp ? "day" : "night";
  }

  const solarNoonMs =
    sunrise && sunset
      ? (sunrise.getTime() + sunset.getTime()) / 2
      : Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const solarNoon = new Date(solarNoonMs);

  let dayLengthMin = 0;
  if (sunrise && sunset) {
    dayLengthMin = Math.max(0, (sunset.getTime() - sunrise.getTime()) / 60_000);
  } else if (polar === "day") {
    dayLengthMin = 1440;
  }

  return { sunrise, sunset, solarNoon, dayLengthMin, polar };
}

/* ------------------------------- moon phase ------------------------------- */

export interface MoonInfo {
  /** Phase fraction 0→1 (0 = new, 0.5 = full). */
  phase: number;
  /** Illuminated fraction 0→1. */
  illumination: number;
  /** Korean phase name. */
  name: string;
  /** Emoji glyph for the phase (visual, not color). */
  emoji: string;
  /** Age of the moon in days since the last new moon. */
  ageDays: number;
}

const SYNODIC = 29.530588853; // mean synodic month, days
// A reference new moon: 2000-01-06 18:14 UTC (Julian-friendly epoch).
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14) / 86_400_000;

const PHASE_NAMES: Array<{ name: string; emoji: string }> = [
  { name: "삭 (신월)", emoji: "🌑" },
  { name: "초승달", emoji: "🌒" },
  { name: "상현달", emoji: "🌓" },
  { name: "상현망간 (차는 볼록달)", emoji: "🌔" },
  { name: "보름달 (망)", emoji: "🌕" },
  { name: "하현망간 (지는 볼록달)", emoji: "🌖" },
  { name: "하현달", emoji: "🌗" },
  { name: "그믐달", emoji: "🌘" },
];

/** Moon phase + illumination for `date` (local clock; UTC days under the hood). */
export function computeMoon(date: Date): MoonInfo {
  const days = date.getTime() / 86_400_000;
  let phase = ((days - NEW_MOON_EPOCH) / SYNODIC) % 1;
  if (phase < 0) phase += 1;

  const ageDays = phase * SYNODIC;
  // Illuminated fraction from the phase angle.
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;

  // Bucket into 8 named phases (centered).
  const idx = Math.floor((phase + 1 / 16) * 8) % 8;
  const { name, emoji } = PHASE_NAMES[idx];

  return { phase, illumination, name, emoji, ageDays };
}

/** Days until the next full / new moon from `date` (whole-ish days). */
export function nextMoonEvents(date: Date): { toFull: number; toNew: number } {
  const { phase } = computeMoon(date);
  const toNew = ((1 - phase) % 1) * SYNODIC;
  const toFull = (((0.5 - phase) % 1) + 1) % 1 * SYNODIC;
  return { toFull, toNew };
}
