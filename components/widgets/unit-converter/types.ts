/**
 * unit-converter widget — config shape (단위/환산 변환).
 *
 *  Stores the selected category + from/to units + the last input value. dataMode:
 *  'static' (pure local computation). All conversion math lives in units.ts.
 */
export interface UnitConverterConfig {
  /** Category id (length/mass/temperature/area/volume/speed/time/data). */
  category: string;
  /** Source unit id within the category. */
  from: string;
  /** Target unit id within the category. */
  to: string;
  /** Last entered value (kept so a re-open shows the same conversion). */
  value: number;
}

export const DEFAULT_UNIT_CONVERTER_CONFIG: UnitConverterConfig = {
  category: "length",
  from: "m",
  to: "km",
  value: 1,
};
